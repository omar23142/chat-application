import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, RequestHandler, Response } from 'express';
import { RejesterDto } from 'src/users/dtos/Rejester.dto';
import { AuthProvider } from './providers/auth.provider';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/users/entity/User.entity';
import { RefreshGuard } from './guards/refresh.guard.ts.guard';
import { ConfigService } from '@nestjs/config';
import { get } from 'http';
import { JwtGuard } from './guards/jwt.guard';
import { GetCurrentUser } from 'src/users/decorators/current-user.decorator';
import { ProtectGard } from './guards/Protect.guard';
import { randomBytes } from 'crypto';
import { CsrfGuard } from './guards/csrfGuard.guard';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(
    private readonly authProvider: AuthProvider,
    private readonly config: ConfigService
  ) {}

  @Post('/signup')
  @Throttle({ default: { limit: 3, ttl: 10000 } })
  public register(@Body() body: RejesterDto, @Req() req: Request) {
    return this.authProvider.sigup(body, req);
  }

  @Post('/signin')
  @Throttle({ default: { limit: 3, ttl: 10000 } })
  @UseGuards(AuthGuard('local'))
  @HttpCode(HttpStatus.OK)
  public async signin(@Req() req: Request, 
  @Res({ passthrough: true }) res:Response
) {
    const {accessToken, refreshToken, user} = await this.authProvider.signin(req.user as User, req);
    console.log('before cookieeeeeeeee',refreshToken);
     res.cookie('RefreshToken', refreshToken, {
      httpOnly:true, // protect from xss attack
      secure: this.config.get('NODE_ENV') === 'production', // use https 
      sameSite:this.config.get('NODE_ENV') === 'production' ? 'none' : 'lax', //protect againest csrf
      maxAge: 7 * 24 * 60 * 60 * 1000
    })
    let csrfToken = randomBytes(32).toString('hex');
    // console.log('csrfffff', csrfToken);
    res.cookie('csrfToken', csrfToken,
     { httpOnly: false, secure: this.config.get('NODE_ENV') === 'production',
      sameSite: this.config.get('NODE_ENV') === 'production' ? 'none' : 'lax', path: '/' });
      
    return {accessToken};
  }

  @Get('/google/login')
  @Throttle({ default: { limit: 3, ttl: 10000 } })
  @UseGuards(AuthGuard('google'))
  public googleLogin(): void {}

  @Get('/google/callback')
  @UseGuards(AuthGuard('google'))
  public async googleCallback(
    @Req() req: Request,
    @Res({passthrough: true}) res: Response) {
    const { password, ...user } = req.user as User;
    const accessToken = await this.authProvider.generateJwtForUser(user as User);
    const refreshToken = await this.authProvider.generateRefreshToken(user as User);
     res.cookie('RefreshToken', refreshToken, {
      httpOnly:true, // protect from xss attack
      secure: this.config.get('NODE_ENV') === 'production', // use https 
      sameSite:this.config.get('NODE_ENV') === 'production' ? 'none' : 'lax', //protect againest csrf
      maxAge: 7 * 24 * 60 * 60 * 1000
    })
    res.cookie('csrfToken', randomBytes(32).toString('hex'),
     { httpOnly: false, secure: this.config.get('NODE_ENV') === 'production',
      sameSite: this.config.get('NODE_ENV') === 'production' ? 'none' : 'lax', path: '/' });
    return { accessToken };
  }


  @HttpCode(HttpStatus.OK)
  @Post('/refreshtoken')
  @Throttle({ default: { limit: 3, ttl: 10000 } })
  @UseGuards(CsrfGuard, RefreshGuard)
  public async refresh(@Req() req: Request,
   @Res({passthrough: true}) res:Response
  ) {
    const { password , refreshToken, ...user } = req.user as User;
    const accessToken = await this.authProvider.generateJwtForUser(user as User);
    const newRefreshToken = await this.authProvider.generateRefreshToken(user as User);
    console.log('befpre cookie');
    res.cookie('RefreshToken', newRefreshToken, {
      httpOnly:true, // protect from xss attack
      secure: this.config.get('NODE_ENV') === 'production', // use https 
      sameSite:this.config.get('NODE_ENV') === 'production' ? 'none' : 'lax', //protect againest csrf
      maxAge: 7 * 24 * 60 * 60 * 1000
    })
    let csrfToken = randomBytes(32).toString('hex');
    console.log('csrfffff', csrfToken);
    res.cookie('csrfToken', csrfToken,
     { httpOnly: false, secure: this.config.get('NODE_ENV') === 'production',
      sameSite: this.config.get('NODE_ENV') === 'production' ? 'none' : 'lax', path: '/' });
    console.log('afterrrrrrr cookie');
    return { accessToken };
  }

  @HttpCode(HttpStatus.OK)
  @Post('/logout')
  @Throttle({ default: { limit: 3, ttl: 10000 } })
  @UseGuards(ProtectGard)
  public logout(
  @Res({passthrough: true}) res: Response,
  @GetCurrentUser() user:User) {
    res.clearCookie('RefreshToken',{
      httpOnly: true,
      secure:this.config.get('NODE_ENV') === 'production',
      sameSite:this.config.get('NODE_ENV') === 'production' ? 'none' : 'lax'
    });
    return this.authProvider.logOut(user);
  }

}
