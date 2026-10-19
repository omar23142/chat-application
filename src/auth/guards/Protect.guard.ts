import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
//import { ConfigService } from "@nestjs/config";
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { CURENT_USER_KEY } from '../../utils/constants';
import { UserService } from '../../users/User.Service';
import { ConfigService } from '@nestjs/config';
import {JwtPayloadType} from '../../utils/types';
import { AuthProvider } from '../providers/auth.provider';
// import { Authconfig } from 'src/config/AuthClass';

@Injectable()
export class ProtectGard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly authProvider:AuthProvider
  ) {}
  async canActivate(context: ExecutionContext) {
    const req: Request = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    // console.log('req.headers', req.headers.authorization);
    // exam the req.cookie have a token
    const [type, jwtToken] = req.headers.authorization?.split(' ') ?? [];
    // console.log(type);
    // console.log('this is jwt test: ', jwtToken);
    // console.log(
    //   `Authorization: ${JSON.stringify(req.headers.authorization, null, 2)}`,
    // );
    const authHeader = req.headers.authorization; // "Bearer eyJhbGci..."
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      // console.log('The Token is:', JSON.stringify(token, null, 2));
    }
    

    let payload: JwtPayloadType;
    try {
      if (type === 'Bearer' && jwtToken) {
        console.log('in jwt verify');
        const secret = this.config.get<string>('JWT_SECRET_KEY');
        if (!secret) {
          throw new UnauthorizedException('access denied , invalid token or expired');
        }
        payload = await this.jwtService.verifyAsync<JwtPayloadType>(jwtToken, {
          secret,
          ignoreExpiration: false
        });
        // console.log('decoded jwt', payload);
      } else {
        throw new UnauthorizedException('access denied , no token provided   ');
      }
    } catch (error: unknown) {
      throw new UnauthorizedException(
        'access denied , invalid token or expired',
      );
    }
    // exam if the user still exist in db and not deleted
    const currentUser = await this.userService.getOne(payload.id);
    if (!currentUser)
      throw new ForbiddenException('the user is no longer exist');
    // exam if the password not modyfied after the jwt token is issued
    if (currentUser.passwordUpdatedAt) {
      const jwtIat = payload.iat * 1000; // seconds
      // console.log(currentUser.passwordUpdatedAt)
      const pwdChanged = currentUser.passwordUpdatedAt.getTime();
       
      // console.log('teimeeeeeeeee', pwdChanged, jwtIat);
      if (jwtIat < pwdChanged) {
        throw new UnauthorizedException('Token invalid due to password change');
      }
    }
    if( payload.accessTokenVersion !== currentUser.accessTokenVersion)
        {
            await this.authProvider.logOut(currentUser);
            res.clearCookie('RefreshToken', { httpOnly: true, path: '/' });
            res.clearCookie('csrfToken', { httpOnly: false, path: '/' });
            throw new UnauthorizedException('Token has been revoked. Please log in again !. ');
        }
    req[CURENT_USER_KEY] = currentUser;
    //  console.log('current user in guard', currentUser)
    return true;
  }
}
