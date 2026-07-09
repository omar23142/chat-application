import { Controller, Req, UseGuards } from '@nestjs/common';
import { Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { User } from 'src/users/entity/User.entity';
import { AuthProvider } from 'src/users/providers/auth.provider';

@Controller('/api/v1/auth')
export class Oauth2Controller {
  constructor(private readonly authProvider: AuthProvider) {}
  @Get('/google/login')
  @UseGuards(AuthGuard('google')) // this will send the req from our server to the google server
  public googleLogin() {
    return 'login ...';
  }
  @Get('/google/signup')
  @UseGuards(AuthGuard('google')) // this will send the req from our server to the google server
  public googlesigup() {
    return 'sigup ...';
  }
  @Get('/google/callback')
  @UseGuards(AuthGuard('google')) // this will send the req from our server to the google server and the AuthGuard will use the validate that we create in our starategy and add the user to req , req.user = user
  public async googleCallback(@Req() req: Request) {
    console.log('req.user', req.user);
    let accessToken: { accessToken: string } | null = null;
    if (req.user) {
      accessToken = await this.authProvider.generateJwtForUser(
        req.user as User,
      );
    }
    return { accessToken, user: req.user };
  }
}
