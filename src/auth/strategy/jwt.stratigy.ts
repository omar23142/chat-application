


import { Inject, Injectable, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt, StrategyOptionsWithRequest } from "passport-jwt";
import { User } from "src/users/entity/User.entity";
import { UserService } from "src/users/User.Service";
import type { JwtPayloadType } from "src/utils/types";
import { AuthProvider } from "../providers/auth.provider";
import type { Response } from "express";



@Injectable()
export class jwtStratigy extends PassportStrategy(Strategy, 'jwtToken') {
    
    constructor(
        @Inject(ConfigService)
            private readonly config:ConfigService,
            private readonly userService:UserService,
            private readonly authProvider: AuthProvider,
            )
            {
                
                super({
        jwtFromRequest:ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: config.get('JWT_SECRET_KEY'),
        ignoreExpiration: false
    } as StrategyOptionsWithRequest  )}
    
    
    async validate(payload: JwtPayloadType) {
        console.log('in the jwt class', payload);
        const user = await this.userService.getOne(payload.id)
        if(!user)
            throw new UnauthorizedException('user is not found or not longer exist');
        if( payload.accessTokenVersion !== user.accessTokenVersion)
        {
            await this.authProvider.logOut(user);
            // await this.authProvider.IncrementAccessTokenVersion(user);
            throw new UnauthorizedException('Token has been revoked. Please log in again. ');
        }
        return  user
    }
}