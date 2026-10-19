import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt, StrategyOptionsWithRequest } from "passport-jwt";
import { User } from "src/users/entity/User.entity";
import { UserService } from "src/users/User.Service";
import { JwtPayloadType } from "src/utils/types";
import { AuthProvider } from "../providers/auth.provider";
import { Request } from "express";
import { IsNull } from "typeorm";



@Injectable()
export class RefreshToken extends PassportStrategy(Strategy, 'refreshToken') {
    
    constructor(
        @Inject(ConfigService)
            private readonly config:ConfigService,
            private readonly authProvider: AuthProvider,
            private readonly userService:UserService
            )
            {
                
                super({
        // jwtFromRequest:ExtractJwt.fromAuthHeaderAsBearerToken() 
        jwtFromRequest: (req) => {
            if (req && req.cookies)
                {
                    console.log('token from cookies',req.cookies['RefreshToken']);
                    return req.cookies['RefreshToken']
                }
            else if(!ExtractJwt.fromAuthHeaderAsBearerToken()(req)?.match('{}'))
               { 
                console.log('token from header', ExtractJwt.fromAuthHeaderAsBearerToken());
                 return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
                }
            return null;
        },
        secretOrKey: config.get('Refresh_JWT_SECRET_KEY'),
        ignoreExpiration: false,
        passReqToCallback: true
    } as StrategyOptionsWithRequest  )}
    
    
    async validate(req: Request, payload: JwtPayloadType,
         
        ) {
        console.log('in the refreshtoken class', payload);
        const RefreshToken:string = req.cookies['RefreshToken'] || req.get('Authorization')?.replace('Bearer', '').trim();
        const user = await this.userService.getOne(payload.id);
        if (!user || !user.refreshToken)
            throw new UnauthorizedException('invalid refreshToken??')
        let valid = await this.authProvider.validateHashedRefreshToken(user, RefreshToken );  // compare the hashedRefreshToken that exist on db with user refreshtoken
        if (valid)
           {
            console.log('validddddddddd');
             return  user;}
    }
}