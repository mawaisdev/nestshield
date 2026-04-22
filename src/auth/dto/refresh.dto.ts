import { IsString, IsUUID } from 'class-validator';

export class RefreshDto {
  @IsString()
  refreshToken: string;

  @IsUUID()
  sessionId: string;
}
