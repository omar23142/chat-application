import { Module } from '@nestjs/common';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Passkey } from './entity/passkey.entity';
import { UsersModule } from 'src/users/users.module';
import { User } from 'src/users/entity/User.entity';
import { AuthProvider } from 'src/auth/providers/auth.provider';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { UserService } from 'src/users/User.Service';

@Module({
  imports: [TypeOrmModule.forFeature([Passkey, User])],
  controllers: [PasskeyController],
  providers: [
    PasskeyService,
    AuthProvider,
    JwtService,
    MailService,
    UserService,
  ],
  exports: [PasskeyService],
})
export class PasskeyModule {}
