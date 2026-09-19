import { Resolver, Query, Mutation, Args, Int, Context, ResolveField, Parent } from '@nestjs/graphql';
import { GraphqlService } from './graphql.service';
import { UserType } from './entities/user.graphql.entity';
import { UserDto } from './dto/userDto';
import { UpdateGraphqlInput } from './dto/update-graphql.input';
import { UserService } from 'src/users/User.Service';
// import { MessageType } from './entities/message.graphql.entity';
import { PrivateChatService } from 'src/chat/private-chat.service';
import { messageResponse } from './entities/messageResponse.graphql';
import type { Request } from 'express';
import { ProtectGard } from 'src/auth/guards/Protect.guard';
import { UseGuards } from '@nestjs/common';
import { GqlProtectGard } from './Gards/gql-protect.guard';
import {GqlRestrictGard} from './Gards/gql-RestrictTo.guard';
import {GetGqlCurrentUser} from './decorators/current-user.decorator';
import { Roles } from './decorators/userRole.decorator';
import { userType } from 'src/utils/enum';

@Resolver(() => UserType)
export class USERResolver {
  
  constructor(
    private readonly graphqlService: GraphqlService,
    private readonly userService:UserService,
    private readonly ChatService: PrivateChatService) {}

  @Mutation(() => UserType)
  Rejester(@Args('userDto') user: UserDto, @Context('req') req: Request) {
    return this.graphqlService.createUser(user, req );
  }
  @Roles(userType.NORMAL_USER, userType.ADMIN)
  @UseGuards(GqlProtectGard, GqlRestrictGard)
  @Query(() => [UserType], { name: 'users' })
  findAll() {
    return this.userService.getAll();
  }
  @UseGuards(GqlProtectGard)
  @Query(() => UserType, { name: 'getOneuser' })
  findOne(@Args('userid', { type: () => Int }) userid: number) {
    return this.userService.getOne(userid);
  }

  @Query(() => UserType, { name: 'me' })
  @UseGuards(GqlProtectGard)
  me(@GetGqlCurrentUser() user: UserType) { return user }

   @ResolveField(() => messageResponse)
    async messages(
      @Parent() user: UserType,                                  
      @Args('roomId', { type: () => Int }) roomId: number,   
) {
  return this.ChatService.getHistory(roomId, user.id);
}

  @Query(() => String)
  userAgent(@Context('req') req: Request): string {
  return req.headers['user-agent'] ?? '';
  }

  @Mutation(() => UserType)
  updateGraphql(@Args('updateuserDto') updateGraphqlInput: UpdateGraphqlInput) {
    return this.graphqlService.update(updateGraphqlInput.id, updateGraphqlInput);
  }

  @Mutation(() => UserType)
  removeGraphql(@Args('id', { type: () => Int }) id: number) {
    return this.graphqlService.remove(id);
  }
}

