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
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayloadType } from 'src/utils/types';
import { RoomManger } from './room-manager.service';
import { PrivateChatService } from './private-chat.service';
import { UserService } from 'src/users/User.Service';
import { ClientEvents, ServerEvents } from './chat-events';

@WebSocketGateway(3001, { cors: { origin: '*' } })
export class Authgateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private jwtService: JwtService,
    private readonly RoomMangerService: RoomManger,
    private readonly privateChatService: PrivateChatService,
    private readonly userService: UserService,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    console.log(`the authgateway is run on port 3001`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runSpeedDating(matchRoom: {
    female: Set<Socket> | null;
    male: Set<Socket> | null;
    id: number;
  }) {
    console.log(
      '[runSpeedDating] Starting speed dating for room:',
      matchRoom.id,
    );
    // snapshot at start to avoid stale sockets
    const females = Array.from(matchRoom.female || []).filter(s => s.connected);
    const males = Array.from(matchRoom.male || []).filter(s => s.connected);
    console.log(
      '[runSpeedDating] Females:',
      females.length,
      'Males:',
      males.length,
    );

    for (let round = 0; round < 5; round++) {
      console.log('[runSpeedDating] Round:', round);
      const roomNames: string[] = [];
      for (let f = 0; f < 5; f++) {
        const m = (f + round) % 5;
        if (females[f]?.connected && males[m]?.connected) {
          roomNames.push(this.CreatePrivateRoom(females[f], males[m]));
        }
      }
      console.log('[runSpeedDating] Created rooms:', roomNames);

      roomNames.forEach((name, i) => {
        const maleSocket = males[(i + round) % 5];
        if (maleSocket?.connected) {
          this.server.to(name).emit(ServerEvents.ROUND_STARTED, {
            round,
            roomId: name,
            partnerId: maleSocket.data.user?.id,
          });
        }
      });

      await this.sleep(5 * 1000);

      // filter out disconnected before emitting
      const activeRooms = roomNames.filter(name => {
        const room = this.RoomMangerService.privateRoom.get(name);
        return room && Array.from(room.members).some(s => s.connected);
      });

      this.server.to(activeRooms).emit(ServerEvents.ROUND_ENDED, { round });
      this.server.to(activeRooms).emit(ServerEvents.RATING_PERIOD_STARTED, { round, timeout: 30_000 });

      await Promise.all(
        activeRooms.map(
          (name) =>
            new Promise<void>((resolve) => {
              const room = this.RoomMangerService.privateRoom.get(name);
              const members = room ? Array.from(room.members).filter(s => s.connected) : [];
              const timer = setTimeout(() => {
                members.forEach((u) => {
                  const uid = u.data.user?.id;
                  if (uid && !room?.ratings.has(uid)) {
                    const disconnected = !(u as any).connected;
                    room?.ratings.set(uid, disconnected ? 0 : 2);
                  }
                });
                console.log('[runSpeedDating] Rating timeout for room:', name);
                resolve();
              }, 30_000);
            }),
        ),
      );

      console.log('[runSpeedDating] Rating period ended, checking matches...');
      this.RoomMangerService.handleMatchRating(activeRooms, this.server, round);
      this.RoomMangerService.DestroyPrivateRoom(activeRooms);
    }

    console.log(
      '[runSpeedDating] All rounds complete, creating permanent rooms...',
    );
    const matches = this.RoomMangerService.getAllPendingMatches();
    console.log('[runSpeedDating] Matches found:', matches.length);
    for (const m of matches) {
      const room = await this.privateChatService.createRoom(
        m.userId1,
        m.userId2,
      );
      this.RoomMangerService.registerPermanentRoom(room.id);
      const user1Sockets = await this.userService.getSocketIds(m.userId1);
      const user2Sockets = await this.userService.getSocketIds(m.userId2);
      user1Sockets.forEach((sid) =>
        this.server.sockets.sockets.get(sid)?.join(`permanent:${room.id}`),
      );
      user2Sockets.forEach((sid) =>
        this.server.sockets.sockets.get(sid)?.join(`permanent:${room.id}`),
      );
      this.server.to(`permanent:${room.id}`).emit(ServerEvents.PERMANENT_ROOM_CREATED, {
        roomId: room.id,
        partnerId: m.userId2,
      });
    }
    this.RoomMangerService.clearPendingMatches();
    this.server
      .to(String(matchRoom.id))
      .emit(ServerEvents.SPEED_DATING_COMPLETE, { matches });
    console.log(
      '[runSpeedDating] Speed dating complete for room:',
      matchRoom.id,
    );
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    console.log('[handleConnection] New connection attempt');
    try {
      const token: string | undefined =
        client.handshake.auth.token ||
        client.handshake.headers['authorization'];
      if (!token) throw new Error('the token is not provided');
      const payload: JwtPayloadType = await this.jwtService.verifyAsync(token);
      console.log('[handleConnection] Token verified for user:', payload.id);
      client.data.user = payload;
      await client.join(`${payload.id}`);
      await this.userService.setOnline(payload.id, client.id);

      // إشعار: المستخدم أصبح متصلاً
      this.server.emit(ServerEvents.USER_STATUS, {
        userId: payload.id,
        isOnline: true,
        lastSeen: null,
      });

      // Match اختياري: لا نُجبر المستخدم. يُرسل findMatch عندما يريد.
    } catch (err) {
      console.log('[handleConnection] Error:', err);
      client.disconnect();
    }
  }

  public handleDisconnect(client: Socket) {
    console.log('[handleDisconnect] Client disconnected:', client.id);
    // mark as disconnected for rating timeout logic
    (client as any).disconnected = true;
    const userId = client.data?.user?.id;
    if (userId) {
      this.userService.setOffline(userId, client.id);
      // إشعار: المستخدم أصبح غير متصل
      this.server.emit(ServerEvents.USER_STATUS, {
        userId,
        isOnline: false,
        lastSeen: new Date(),
      });
    }
    if (client.data?.user?.gender) {
      this.RoomMangerService.removeClientFromGroupRoom(
        client,
        client.data.user.gender,
      );
    }
    this.RoomMangerService.removeClientFromPrivateRoom(client);
  }

  // ─────────────────────────────────────────────
  // 🔵 Match Events
  // ─────────────────────────────────────────────

  @SubscribeMessage(ClientEvents.FIND_MATCH)
  async handleFindMatch(@ConnectedSocket() client: Socket) {
    console.log('[handleFindMatch] User:', client.data?.user?.id);
    try {
      const result = await this.RoomMangerService.FindmatchRoom(
        client,
        client.data.user.gender,
      );
      client.emit(ServerEvents.ENTERED_MATCH, {
        roomId: result?.room.id,
        isFull: result?.justBecameFull,
      });
      if (result?.justBecameFull) {
        console.log('[handleFindMatch] Room full, starting speed dating...');
        this.runSpeedDating(result.room).catch((err) =>
          console.error('[runSpeedDating] error:', err),
        );
      }
    } catch (err) {
      client.emit('error', { event: 'findMatch', message: (err as Error).message });
    }
  }

  // ─────────────────────────────────────────────
  // 🔵 Group Room Events
  // ─────────────────────────────────────────────

  @SubscribeMessage(ClientEvents.JOIN_GROUP_ROOM)
  public async CreateGroupRoom(@ConnectedSocket() client: Socket) {
    const room = await this.RoomMangerService.AssignRoom(
      client.data.user.id,
      client,
      client.data.user.gender,
    );
    await client.join(`${room.id}`);
    // إشعار للمنضم: تم تخصيص غرفة له
    client.emit(ServerEvents.ROOM_ASSIGNED, { roomId: room.id });
    // إشعار لبقية أعضاء الغرفة: مستخدم جديد انضم
    client.to(`${room.id}`).emit(ServerEvents.USER_JOINED, {
      roomId: room.id,
      userId: client.data.user.id,
      message: `new user with id ${client.data.user.id} joined the room`,
    });
  }

  // ─────────────────────────────────────────────
  // 🔵 Message Events
  // ─────────────────────────────────────────────

  @SubscribeMessage(ClientEvents.NEW_MESSAGE)
  async handleNewMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: { roomId: number; text: string },
  ) {
    const senderId = client.data.user.id;

    // غرفة دائمة (بعد التطابق) → حفظ في DB + بثّ مع معرّف فعلي
    if (this.RoomMangerService.isPermanentRoom(message.roomId)) {
      const saved = await this.privateChatService.saveMessage(
        message.roomId,
        senderId,
        message.text,
      );
      this.server.to(`permanent:${message.roomId}`).emit(ServerEvents.NEW_MESSAGE, {
        id: saved.id,
        roomId: message.roomId,
        message: message.text,
        senderId,
        createdAt: saved.createdAt,
      });
      return;
    }

    // غرفة جماعية/مطابقة → بثّ مؤقت فقط (بدون حفظ)
    client.to(`${message.roomId}`).emit(ServerEvents.NEW_MESSAGE, {
      message: message.text,
      senderId,
    });
  }

  @SubscribeMessage(ClientEvents.MESSAGE_READ)
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number; messageId: number },
  ) {
    // إيصالات القراءة للغرف الدائمة فقط
    if (!this.RoomMangerService.isPermanentRoom(data.roomId)) return;

    const readerId = client.data.user.id;
    try {
      await this.privateChatService.markAsRead(
        data.roomId,
        readerId,
        data.messageId,
      );
      this.server.to(`permanent:${data.roomId}`).emit(ServerEvents.READ_RECEIPT, {
        roomId: data.roomId,
        messageId: data.messageId,
        readBy: readerId,
        readAt: new Date(),
      });
    } catch (err) {
      client.emit('error', {
        event: 'messageRead',
        message: (err as Error).message,
      });
    }
  }

  // ─────────────────────────────────────────────
  // 🔵 Rating Events
  // ─────────────────────────────────────────────

  @SubscribeMessage(ClientEvents.RATING)
  handleRating(
    @ConnectedSocket() client: Socket,
    @MessageBody() rating: number,
  ) {
    console.log(
      '[handleRating] Rating received:',
      rating,
      'from user:',
      client.data?.user?.id,
    );
    this.RoomMangerService.handleRating(client, rating);
  }

  // ─────────────────────────────────────────────
  // 🔵 Typing Events
  // ─────────────────────────────────────────────

  @SubscribeMessage(ClientEvents.TYPING)
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number | string },
  ) {
    client.to(`${data.roomId}`).emit(ServerEvents.USER_TYPING, {
      userId: client.data.user.id,
      roomId: data.roomId,
    });
  }

  @SubscribeMessage(ClientEvents.STOP_TYPING)
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number | string },
  ) {
    client.to(`${data.roomId}`).emit(ServerEvents.USER_STOP_TYPING, {
      userId: client.data.user.id,
      roomId: data.roomId,
    });
  }

  // ─────────────────────────────────────────────
  // 🔧 Private (مدمج)
  // ─────────────────────────────────────────────

  private CreatePrivateRoom(first: Socket, second: Socket) {
    return this.RoomMangerService.CreatePrivateChatRoom(first, second);
  }
}
