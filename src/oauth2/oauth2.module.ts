import { Module } from '@nestjs/common';
import { Oauth2Controller } from './oauth2.controller';
import { GoogleStrategy } from './strategy/google.strategy';
import { AuthProvider } from 'src/users/providers/auth.provider';
import { User } from 'src/users/entity/User.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from 'src/mail/mail.module';

@Module({
  controllers: [Oauth2Controller],
  providers: [GoogleStrategy, AuthProvider],
  imports: [
    MailModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '60s' },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class Oauth2Module {}
