import { Resolver, Query, Mutation, Args, Int, Context, ResolveField, Parent } from '@nestjs/graphql';
import { GraphqlService } from './graphql.service';
import { UserType } from './entities/user.graphql.entity';
import { UserDto } from './dto/userDto';
import { UpdateUserDto } from './dto/updateUserDto';
import { ResetPasswordInput } from './dto/reset-password.input';
import { UserService } from 'src/users/User.Service';
import { PrivateChatService } from 'src/chat/private-chat.service';
import { messageResponse } from './entities/messageResponse.graphql';
import type { Request } from 'express';
import { UseGuards } from '@nestjs/common';
import { GqlProtectGard } from './Guards/gql-protect.guard';
import { GqlRestrictGard } from './Guards/gql-RestrictTo.guard';
import { GetGqlCurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/userRole.decorator';
import { userType } from 'src/utils/enum';
import { ChangPassDto } from './dto/updatePasswordDto';
import { User } from 'src/users/entity/User.entity';
import { MutationResult } from './entities/mutation.Result';

@Resolver(() => UserType)
export class USERResolver {
  
  constructor(
    private readonly graphqlService: GraphqlService,
    private readonly userService:UserService,
    private readonly ChatService: PrivateChatService) {}

 
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
  Rejester(@Args('userDto') user: UserDto, @Context('req') req: Request) {
    return this.graphqlService.createUser(user, req );
  }

  @UseGuards(GqlProtectGard)
  @Mutation(() => UserType)
  updateUser(@Args('updateuserDto') dto: UpdateUserDto,
 @GetGqlCurrentUser('user') user : User) {
  console.log('rrrrrrrrrrrrrrrrr', user.id);
    return this.graphqlService.updateOne(dto, user.id);
  }
  @UseGuards(GqlProtectGard)
  @Mutation(() => UserType)
  DeleteMe(@Args('id', { type: () => Int }) id: number) {
    return this.graphqlService.deleteMe(id);
  }
  @UseGuards(GqlProtectGard)
  @Mutation(() => MutationResult)
  changepass(@Args('updateDto', { type: () => ChangPassDto }) dto: ChangPassDto,
  @GetGqlCurrentUser('user') user : User) {
    // console.log('ttttttttttttttttttttttttttttttt',  user.id);
    return this.graphqlService.changePassword(dto, user.id);
  }

  @UseGuards(GqlProtectGard)
  @Mutation(() => MutationResult)
  async forgetPassword(
    @Args('email', { type: () => String, nullable: true }) email: string,
    @Args('userName', { type: () => String, nullable: true }) userName: string,
    @Context('req') req: Request ,
    @GetGqlCurrentUser() user: User) {

    return  this.graphqlService.ForgetPassword(req, user, email, userName);
  }

  @Mutation(() => MutationResult)
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
  ) {
    return this.graphqlService.resetPassword(
      input.token,
      input.newPassword,
      input.passwordConf,
    );
  }
}

