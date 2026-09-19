import { createParamDecorator } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { CURENT_USER_KEY } from '../../utils/constants';
import { JwtPayloadType } from '../../utils/types';
import { User } from 'src/users/entity/User.entity';
import { GqlExecutionContext } from '@nestjs/graphql';
import {Request} from 'express';

export const GetGqlCurrentUser = createParamDecorator(
  (data, context: ExecutionContext) => {
    const req: Request = GqlExecutionContext.create(context).getContext().req;
    const current_user: User = req[CURENT_USER_KEY];
    return current_user;
  },
);
