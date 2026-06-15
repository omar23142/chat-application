/* eslint-disable @typescript-eslint/no-unused-vars */
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  ConnectedSocket,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { randomUUID } from 'crypto';

import { errorContext } from 'rxjs/internal/util/errorContext';
import { Server, Socket } from 'socket.io';
import { JwtPayloadType } from 'src/utils/types';
import { RoomManger } from './room-manager.service';

@WebSocketGateway(3001)
export class Authgateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private jwtService: JwtService,
    private readonly RoomMangerService: RoomManger,
  ) {}
  server: Server;
  afterInit(server: Server) {
    console.log(`the authgateway is run on port 3001`);
  }
  async handleConnection(@ConnectedSocket() client: Socket) {
    // console.log(client);
    const maleClient: Socket[] = [];
    const famaleClient: Socket[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const token: string | undefined =
        client.handshake.auth.token ||
        client.handshake.headers['authorization'];
      if (!token) throw new Error('the token is not provided');
      const payload: JwtPayloadType = await this.jwtService.verifyAsync(token);
      console.log('payyyyyyyy', payload);
      client.data.user = payload;
      console.log('client.data.user', client.data.user);
      client.join(`${payload.id}`);
      console.log('client connected successfully');
      if (client.data.user.gender === 'male') maleClient.push(client);
      famaleClient.push(client);
      this.CreateRoom(client);
    } catch (err) {
      console.log(err);
      client.disconnect();
    }
  }
  public handleDisconnect(client: Socket) {
    this.RoomMangerService.removeClient(client, client.data.user.gender);
  }

  @SubscribeMessage('newMessage')
  handleNewMessage(
    client: Socket,
    @MessageBody() message: { roomId: number; text: string },
  ) {
    client.to(`${message.roomId}`).emit('newMessage', {
      message: message.text,
      senderId: client.data.user.id,
    });
    client.emit('roomAssigned', { roomId: room.id });
  }

  public CreateRoom(client: Socket) {
    // const roomName: string = `room${crypto.randomUUID()}`;
    // console.log('the user is join to Room', roomName);
    // console.log('ccccccccccc', client.data);

    const room = this.RoomMangerService.AssignRoom(
      client.data.user.id,
      client,
      client.data.user.gender,
    );
    client.join(`${room.id}`);
    // console.log('roommmmmmmmmm', room);

    client
      .to(`${room.id}`)
      .emit('newMessage', ` new user is join to ${room.id}`);
  }
}
