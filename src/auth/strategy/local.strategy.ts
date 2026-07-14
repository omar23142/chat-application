import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthProvider } from '../providers/auth.provider';
import { User } from '../../users/entity/User.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authProvider: AuthProvider) {
    // passport-local expects "username" by default — override to "email"
    super({ usernameField: 'email' });
  }

  /**
   * Passport calls this automatically with AuthGuard('local').
   * Request body must contain { email, password }.
   *
   * - Wrong credentials → throw UnauthorizedException (Passport returns 401)
   * - Correct credentials → return user (Passport sets req.user = user)
   *   Controller then checks isVerified to decide: JWT or verification email
   */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.authProvider.validateLocalUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }
}
