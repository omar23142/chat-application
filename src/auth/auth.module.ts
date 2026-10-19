import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GoogleStrategy } from './strategy/google.strategy';
import { LocalStrategy } from './strategy/local.strategy';
import { AuthProvider } from './providers/auth.provider';
import { User } from '../users/entity/User.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { PasskeyModule } from './strategy/passkey/passkey.module';
import { Passkey } from './strategy/passkey/entity/passkey.entity';
import { RefreshGuard } from './guards/refresh.guard.ts.guard';
import { RefreshToken } from './strategy/refreshToken.strategy';
import { jwtStratigy } from './strategy/jwt.stratigy';
import { UserService } from 'src/users/User.Service';

@Module({
  controllers: [AuthController],
  providers: [GoogleStrategy, LocalStrategy, jwtStratigy, AuthProvider, JwtService, RefreshToken],
  imports: [
    UsersModule,
    MailModule,
    PasskeyModule,
    TypeOrmModule.forFeature([User, Passkey]),
    
  ],
  exports: [AuthProvider],
})
export class AuthModule {}
