import { Controller, UseGuards } from '@nestjs/common';
import { Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('/api/v1/auth')
export class Oauth2Controller {
  @Get('/google/login')
  @UseGuards(AuthGuard('google')) // this will send the req from our server to the google server
  public googleLogin() {
    return 'login ...';
  }
  @Get('/google/callback')
  @UseGuards(AuthGuard('google')) // this will send the req from our server to the google server
  public googleCallback() {
    return 'callback';
  }
}
