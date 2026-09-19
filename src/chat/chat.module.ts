import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { User } from 'src/users/entity/User.entity';
import { PrivateChatRoom } from './entity/PrivateChatRoom.entity';
import { PrivateMessage } from './entity/PrivateMessage.entity';
import { ChatController } from './chat.controller';
import { PrivateChatService } from './private-chat.service';
import { RoomManger } from './room-manager.service';
import { Authgateway } from './ChatAuth.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrivateChatRoom, PrivateMessage, User]),
    UsersModule,
    JwtModule,
  ],
  controllers: [ChatController],
  providers: [PrivateChatService, RoomManger, Authgateway],
  exports: [PrivateChatService],
})
export class ChatModule {}