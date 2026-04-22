import {
  ConflictException,
  Injectable,
  NotFoundException,
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
      userId: user.id,
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
