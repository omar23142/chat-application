import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile } from 'passport';
import { Strategy, StrategyOptions } from 'passport-google-oauth2';
import { AuthProvider } from '../../users/providers/auth.provider';
import { User } from 'src/users/entity/User.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from 'src/utils/types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly AuthProvider: AuthProvider,
    @InjectRepository(User)
    private readonly UserRepo: Repository<User>,
  ) {
    super({
      clientID: process.env.GOOGLE_CLIENTID,
      clientSecret: process.env.GOOGLE_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK,
      scope: ['email', 'profile'],
    } as StrategyOptions);
  }
  public async validate(profile: Profile): Promise<any> {
    const { emails, username, photos } = profile;
    const user = await this.AuthProvider.validateOAuthUser({
      email: emails && emails.length > 0 ? emails[0].value : '',
      userName: username ? username : '',
      photo: photos && photos.length > 0 ? photos[0].value : undefined,
    });
    return user;
  }
}
