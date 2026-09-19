import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
//import { ConfigService } from "@nestjs/config";
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { CURENT_USER_KEY } from '../../utils/constants';
import { userType } from '../../utils/enum';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlRestrictGard implements CanActivate {
  constructor(
    // private readonly jwtService: JwtService,
    //private readonly config:ConfigService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req: Request = GqlExecutionContext.create(context).getContext().req;
    const roles: userType[] = this.reflector.getAllAndOverride<userType[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    if (!roles || roles.length === 0)
      throw new ForbiddenException(`you are don't pass the Roles decoreator`);
    const user = await req[CURENT_USER_KEY];
    if (roles.includes(user.role)) return true;
    console.log('in the restrict to ', roles);
    console.log(user);
    throw new ForbiddenException('you are not allowed to do this ');
  }
}
