


import { Resolver, Query, Mutation, Args, Int, Context, ResolveField, Parent } from '@nestjs/graphql';
import { UserType } from './entities/user.graphql.entity';
import { UserService } from 'src/users/User.Service';
// import { MessageType } from './entities/message.graphql.entity';
import { PrivateChatService } from 'src/chat/private-chat.service';
import { UseGuards } from '@nestjs/common';
import { GqlProtectGard } from './Guards/gql-protect.guard';
import {GqlRestrictGard} from './Guards/gql-RestrictTo.guard';
import { Roles } from './decorators/userRole.decorator';
import { userType } from 'src/utils/enum';
import { MessageType } from './entities/message.graphql.entity';
import { RoomType } from './entities/room.graphql.entity';
import { DataLoaderService } from './DataLoader.service';

@Resolver(() => MessageType)
export class MessageResolver {
  
  constructor(
    private readonly userService:UserService,
    private readonly chatService: PrivateChatService,
    private readonly dataLoader:DataLoaderService) {}

    @Roles(userType.NORMAL_USER, userType.ADMIN)
    @UseGuards(GqlProtectGard, GqlRestrictGard)
    @Query(() => [MessageType], { name: 'getmessage' })
    async findmessage(@Args('roomId', { type: () => Int }) roomId:number, @Args('userId', { type: () => Int })  userId: number) {
        let message =  await this.chatService.getHistory(roomId, userId);
        // console.log('mmmmmmmmmmmmmmmmmmmmmmmmmmmmm', message.messages);
        return message.messages;
    };


//  @ResolveField(() => UserType, { nullable: true })
//   async sender(@Parent() msg: MessageType) {
//     console.log(`🔍 Fetching sender for message ${msg.id} (senderId: ${msg.senderId})`);
//     return this.userService.getOne(msg.senderId);  // ⚠️ query واحد لكل رسالة!
//   }

//   @ResolveField(() => RoomType, { nullable: true })
//   async room(@Parent() msg: MessageType) {
//     console.log(`🔍 Fetching room for message ${msg.id} (roomId: ${msg.roomId})`);
//     return this.chatService.getRoomById(msg.roomId);  // ⚠️ query واحد لكل رسالة!
//   }

@ResolveField(() => UserType, { nullable: true })
  async sender(@Parent() msg: MessageType) {
    return this.dataLoader.getUserById(msg.senderId);  // ✅ batch + cache!
  }

  @ResolveField(() => RoomType, { nullable: true })
  async room(@Parent() msg: MessageType) {
    return this.dataLoader.getRoomById(msg.roomId);    // ✅ batch + cache!
  }
}

