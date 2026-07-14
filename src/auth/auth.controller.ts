import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RejesterDto } from 'src/users/dtos/Rejester.dto';
import { AuthProvider } from './providers/auth.provider';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/users/entity/User.entity';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly authProvider: AuthProvider) {}

  @Post('/signup')
  @Throttle({ default: { limit: 3, ttl: 10000 } })
  public register(@Body() body: RejesterDto, @Req() req: Request) {
    return this.authProvider.sigup(body, req);
  }

  @Post('/signin')
  @Throttle({ default: { limit: 3, ttl: 10000 } })
  @UseGuards(AuthGuard('local'))
  @HttpCode(HttpStatus.OK)
  public async signin(@Req() req: Request) {
    return this.authProvider.signin(req.user as User, req);
  }

  @Get('/google/login')
  @UseGuards(AuthGuard('google'))
  public googleLogin(): void {}

  @Get('/google/callback')
  @UseGuards(AuthGuard('google'))
  public async googleCallback(@Req() req: Request) {
    const { password, ...user } = req.user as User;
    const accessToken = await this.authProvider.generateJwtForUser(user as User);
    return { accessToken, user };
  }
}
