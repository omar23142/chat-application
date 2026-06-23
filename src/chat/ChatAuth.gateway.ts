/* eslint-disable @typescript-eslint/no-unused-vars */
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  ConnectedSocket,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
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
  // clients: Socket[] = [];
  afterInit(server: Server) {
    console.log(`the authgateway is run on port 3001`);
  }
  async handleConnection(@ConnectedSocket() client: Socket) {
    // console.log(client);
    // const maleClient: Socket[] = [];
    // const famaleClient: Socket[] = [];
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
      await client.join(`${payload.id}`);
      console.log('client connected successfully');
      const matchRoom = this.RoomMangerService.FindmatchRoom(
        client,
        client.data.user.gender,
      );
      if (matchRoom && matchRoom.full) {
        const femaleMembers = matchRoom.female
          ? Array.from(matchRoom.female)
          : [];
        const maleMembers: Socket[] = matchRoom.male
          ? Array.from(matchRoom.male)
          : [];
        console.log('matched room members', {
          femaleCount: femaleMembers.length,
          maleCount: maleMembers.length,
        });
        let privateroom = '';
        let privaterooms: string[] = [];
        const privateroomsRating: string[] = [];
        for (let round = 0; round <= 4; round++) {
          setTimeout(
            () => {
              for (let f = 0; f <= 4; f++) {
                if (privaterooms.length === 5) {
                  this.RoomMangerService.handleMatchRating(
                    privaterooms,
                    this.server,
                    round,
                  );
                  this.RoomMangerService.DestroyPrivateRoom(privaterooms);
                  privaterooms = [];
                }
                // console.log('trddddddd', femaleMembers[i]);
                const m = (round + f) % 5;
                privateroom = this.CreatePrivateRoom(
                  femaleMembers[f],
                  maleMembers[m],
                );
                privaterooms.push(privateroom);
                // femaleMembers.pop();
                console.log(privateroom);
                console.log(privaterooms);
              }
            },
            round * 5 * 1000,
            //  * 60,
          );
        }
      }
      // this.CreateGroupRoom(client);
      // this.clients.push(client);
      // console.log('length', this.clients.length);
      // if (this.clients.length >= 2) this.CreatePrivateRoom(this.clients[0], this.clients[1]);
    } catch (err) {
      console.log(err);
      client.disconnect();
    }
  }
  public handleDisconnect(client: Socket) {
    if (client.data?.user?.gender) {
      // console.log('disconnecttttt', client);
      this.RoomMangerService.removeClientFromGroupRoom(
        client,
        client.data.user.gender,
      );
    }
    this.RoomMangerService.removeClientFromPrivateRoom(client);
  }
  @SubscribeMessage('newMessage')
  handleNewMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: { roomId: number; text: string },
  ) {
    console.log('newMessage', message);
    client.to(`${message.roomId}`).emit('newMessage', {
      message: message.text,
      senderId: client.data.user.id,
    });
  }

  @SubscribeMessage('rating')
  handleRating(
    @ConnectedSocket() client: Socket,
    @MessageBody() rating: number,
  ) {
    console.log('rating received:', rating);
    this.RoomMangerService.handleRating(client, rating);
  }
  public CreateGroupRoom(client: Socket) {
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
    setTimeout(() => {
      client.emit('roomAssigned', { roomId: room.id });
    }, 200);
    client
      .to(`${room.id}`)
      .emit(
        'userJoined',
        ` new user with id ${client.data.user.id} is join to the room  `,
      );
  }
  public CreatePrivateRoom(first: Socket, second: Socket) {
    const room = this.RoomMangerService.CreatePrivateChatRoom(first, second);
    return room;
    // first
    //   .to(`${room}`)
    //   .emit(
    //     'userJoined',
    //     ` new user with id ${first.data.user.id} is join to the room  `,
    //   );
    // second
    //   .to(`${room}`)
    //   .emit(
    //     'userJoined',
    //     ` new user with id ${second.data.user.id} is join to the room  `,
    //   );
  }
}
