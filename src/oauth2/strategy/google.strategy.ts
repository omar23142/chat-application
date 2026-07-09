/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
    // @InjectRepository(User)
    // private readonly UserRepo: Repository<User>,
  ) {
    super({
      clientID: process.env.GOOGLE_CLIENTID,
      clientSecret: process.env.GOOGLE_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK,
      scope: ['email', 'profile'],
    } as StrategyOptions);
  }
  public async validate(accessToken, refreshToken, profile: any): Promise<any> {
    // console.log('profileeeeeeeeeeeeeeee', profile);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { displayName, emails, photos, _json } = profile;
    console.log('_json', _json);
    const user = await this.AuthProvider.validateOAuthUser({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      email: emails?.[0]?.value ?? '',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      userName: displayName ?? emails?.[0]?.value?.split('@')[0] ?? '',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      photo: photos?.[0]?.value ?? undefined,
    });
    return user;
  }
}
