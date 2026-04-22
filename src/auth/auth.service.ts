import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Session } from './entities/session.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';

import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { TOTP } from 'otplib';

@Injectable()
export class AuthService {
  private readonly MAX_SESSIONS: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.MAX_SESSIONS = this.configService.get<number>('MAX_SESSIONS', 3);
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) throw new ConflictException('Email ALready in use.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const defaultRole = await this.roleRepository.findOne({
      where: { name: 'user' },
    });

    if (!defaultRole)
      throw new NotFoundException('Default role not found run seeder first');

    const user = this.userRepository.create({
      email: dto.email,
      password: passwordHash,
      roles: [defaultRole],
    });

    await this.userRepository.save(user);

    return this.createSession(user, dto.deviceInfo, ipAddress);
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['roles'],
    });

    if (!user) throw new UnauthorizedException('Invalid Credentials');

    if (!user.isActive) throw new ForbiddenException('Account is disabled');

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid Credentials');

    if (user.isTwoFactorEnabled) {
      if (!dto.totpCode) {
        throw new UnauthorizedException('2FA Code is required');
      }
      const isValid = await this.verifyTwoFactorCode(user.id, dto.totpCode);
      if (!isValid) throw new UnauthorizedException('Invalid 2FA Code');
    }

    const activeSession = await this.sessionRepository.count({
      where: { user: { id: user.id }, isActive: true },
    });

    if (activeSession >= this.MAX_SESSIONS) {
      throw new ForbiddenException(
        `Maximum active sessions (${this.MAX_SESSIONS}) reached — please logout from another device first`,
      );
    }

    return this.createSession(user, dto.deviceInfo, ipAddress);
  }

  private async createSession(
    user: User,
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    const refreshToken = this.generateSecureToken();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();

    expiresAt.setDate(
      expiresAt.getDate() +
        this.parseDaysFromExpiry(
          this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        ),
    );

    const session = this.sessionRepository.create({
      user: { id: user.id },
      refreshTokenHash,
      deviceInfo,
      ipAddress,
      expiresAt,
    });

    await this.sessionRepository.save(session);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.roles.map((r) => r.name),
      sessionId: session.id,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles.map((r) => r.name),
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    };
  }

  private async verifyTwoFactorCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.twoFactorSecret')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user?.twoFactorSecret) {
      return false;
    }
    const totp = new TOTP();
    const result = await totp.verify(code, { secret: user.twoFactorSecret });
    return result as unknown as boolean;
  }

  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const charsLength = chars.length;
    let token = '';

    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * charsLength));
    }

    return token;
  }

  private parseDaysFromExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)d$/);
    return match ? parseInt(match[1], 10) : 7;
  }
}
