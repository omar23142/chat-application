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

@Module({
  controllers: [AuthController],
  providers: [GoogleStrategy, LocalStrategy, AuthProvider, JwtService],
  imports: [
    UsersModule,
    MailModule,
    PasskeyModule,
    TypeOrmModule.forFeature([User, Passkey]),
  ],
  exports: [AuthProvider],
})
export class AuthModule {}
