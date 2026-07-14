import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import { ProtectGard } from 'src/auth/guards/Protect.guard'; // Assuming you have this guard
import { GetCurrentUser } from 'src/users/decorators/current-user.decorator';
import { User } from 'src/users/entity/User.entity';

@Controller('/api/v1/auth/passkey')
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {} // Inject the service

  // ==========================================
  // REGISTRATION ENDPOINTS (Authenticated)
  // ==========================================

  @Get('/register/options')
  @UseGuards(ProtectGard) // Ensure the user is logged in to register a passkey
  public async getRegisterOptions(@GetCurrentUser() user: User) {
    // Request options with a challenge for registration
    return this.passkeyService.getRegistrationOptions(user);
  }

  @Post('/register/verify')
  @UseGuards(ProtectGard) // Ensure the user is logged in
  public async verifyRegister(
    @Body() body: any, // The payload returned by the browser's credentials API
    @GetCurrentUser() user: User,
  ) {
    // Verify the registered credentials
    return this.passkeyService.verifyRegistration(body, user);
  }

  // ==========================================
  // AUTHENTICATION ENDPOINTS (Unauthenticated)
  // ==========================================

  @Post('/login/options')
  public async getLoginOptions(@Body('email') email: string) {
    // Generate a challenge based on user email
    return this.passkeyService.getAuthenticationOptions(email);
  }

  @Post('/login/verify')
  public async verifyLogin(
    @Body('email') email: string, // User email to lookup DB details
    @Body('response') response: any, // The signed challenge response payload from browser
  ) {
    // Authenticate the user and return a JWT if validation succeeds
    return this.passkeyService.verifyAuthentication(response, email);
  }
}
