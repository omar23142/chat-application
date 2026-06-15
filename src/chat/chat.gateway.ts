import { OnModuleInit } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway(8001)
export class ChatGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;
  onModuleInit() {
    // when client connect with server
    this.server.on('connection', (client) => {
      console.log(`the new user with id ${client.id} is connected successfuly`);
    });
  }

  @SubscribeMessage('newMessage')
  handleNewMessage(@MessageBody() message: string): void {
    this.server.emit('newMessage', message);
  }

  @SubscribeMessage('spicificuser')
  handleSpicificuser(
    @MessageBody() data: { clientId: string; message: string },
  ) {
    console.log('clientId', data, data.clientId);
    const targetUser = this.server.sockets.sockets.get(data.clientId);
    targetUser?.emit('spicificuser', data.message);
    // client.to(roomName).emit('sysMessage', `...`);
  }
}
