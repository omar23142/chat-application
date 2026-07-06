import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ServerEvents } from './chat-events';

interface RoomData {
  id: number;
  male: Set<Socket> | null;
  female: Set<Socket> | null;
  full: boolean;
}

interface PrivateRoomData {
  members: Set<Socket>;
  ratings: Map<string, number>;
}

interface PendingMatch {
  userId1: number;
  userId2: number;
  round: number;
}

@Injectable()
export class RoomManger {
  private GrouproomFromSocket = new Map<Socket, RoomData>();
  private GroupRooms = new Map<number, RoomData>();
  public privateRoom = new Map<string, PrivateRoomData>();
  private PrivateRoomFromSocket = new Map<Socket, string>();
  private MatchRooms = new Map<number, RoomData>();
  private MatchRoomFromSocket = new Map<Socket, RoomData>();
  private pendingMatches = new Map<string, PendingMatch>();
  private permanentRoomDbIds = new Set<number>();
  private nextId = 1;

  // queue-based mutex for the FindmatchRoom critical section
  private queue: (() => void)[] = [];
  private isLocked = false;

  public CreatePrivateChatRoom(firstClient: Socket, secondClient: Socket) {
    const PrivatRoomName: string = `private${firstClient.data.user.id}_${secondClient.data.user.id}`;
    firstClient.join(PrivatRoomName);
    secondClient.join(PrivatRoomName);
    const members = new Set<Socket>();
    members.add(firstClient);
    members.add(secondClient);
    const privateRoomData: PrivateRoomData = {
      members,
      ratings: new Map<string, number>(),
    };
    this.privateRoom.set(PrivatRoomName, privateRoomData);
    this.PrivateRoomFromSocket.set(firstClient, PrivatRoomName);
    this.PrivateRoomFromSocket.set(secondClient, PrivatRoomName);
    setTimeout(() => {
      firstClient.emit(ServerEvents.ROOM_ASSIGNED, {
        roomId: PrivatRoomName,
        partnerId: secondClient.data.user.id,
      });
      secondClient.emit(ServerEvents.ROOM_ASSIGNED, {
        roomId: PrivatRoomName,
        partnerId: firstClient.data.user.id,
      });
    }, 200);
    return PrivatRoomName;
  }

  public removeClientFromPrivateRoom(first: Socket) {
    const Room = this.PrivateRoomFromSocket.get(first);
    if (!Room) return;
    const privateRoomData = this.privateRoom.get(Room);
    if (!privateRoomData) return;
    const members = privateRoomData.members;
    const second = members
      ? Array.from(members).find((member) => member !== first)
      : undefined;
    first.to(Room).emit(ServerEvents.PARTNER_LEFT, { roomId: Room });
    this.PrivateRoomFromSocket.delete(first);
    if (second) {
      this.PrivateRoomFromSocket.delete(second);
    }
    first.leave(Room);
    second?.leave(Room);
    this.privateRoom.delete(Room);
  }

  public DestroyPrivateRoom(rooms: string[]) {
    for (const room of rooms) {
      const privateRoomData = this.privateRoom.get(room);
      if (!privateRoomData) continue;
      const members = privateRoomData.members;
      if (!members || members.size === 0) continue;
      const [first, second] = Array.from(members);

      first.to(room).emit(ServerEvents.PARTNER_LEFT, { roomId: room });
      this.PrivateRoomFromSocket.delete(first);
      if (second) {
        this.PrivateRoomFromSocket.delete(second);
      }
      first.leave(room);
      second?.leave(room);
      this.privateRoom.delete(room);
    }
  }

  public handleRating(client: Socket, rating: number): void {
    if (rating < 1 || rating > 5) {
      client.emit(ServerEvents.RATING_ERROR, { message: 'Rating must be between 1 and 5' });
      return;
    }

    const roomName = this.PrivateRoomFromSocket.get(client);
    if (!roomName) {
      client.emit(ServerEvents.RATING_ERROR, { message: 'You are not in a private room' });
      return;
    }

    const privateRoomData = this.privateRoom.get(roomName);
    if (!privateRoomData) {
      client.emit(ServerEvents.RATING_ERROR, { message: 'Private room not found' });
      return;
    }

    const userId = client.data.user?.id;
    if (!userId) {
      client.emit(ServerEvents.RATING_ERROR, { message: 'User not authenticated' });
      return;
    }

    privateRoomData.ratings.set(userId, rating);

    const members = Array.from(privateRoomData.members);
    if (members.length === 2) {
      const [firstUser, secondUser] = members;
      const firstUserId = firstUser.data.user?.id;
      const secondUserId = secondUser.data.user?.id;

      if (firstUserId && secondUserId) {
        const firstHasRated = privateRoomData.ratings.has(firstUserId);
        const secondHasRated = privateRoomData.ratings.has(secondUserId);

        if (firstHasRated && secondHasRated) {
          const firstRating = privateRoomData.ratings.get(firstUserId) || 0;
          const secondRating = privateRoomData.ratings.get(secondUserId) || 0;

          firstUser.emit(ServerEvents.RATING_COMPLETE, {
            roomId: roomName,
            yourRating: firstRating,
            partnerRating: secondRating,
          });

          secondUser.emit(ServerEvents.RATING_COMPLETE, {
            roomId: roomName,
            yourRating: secondRating,
            partnerRating: firstRating,
          });
          setTimeout(() => {
            this.DestroyPrivateRoom([roomName]);
          }, 500);
        } else {
          const partnerHasRated =
            firstUserId === userId ? secondHasRated : firstHasRated;
          client.emit(ServerEvents.RATING_RECORDED, {
            message: partnerHasRated
              ? 'Both ratings received! Room closing...'
              : 'Your rating has been recorded. Waiting for partner to rate...',
          });
        }
      }
    }
  }

  public handleMatchRating(
    privaterooms: string[],
    server: Server,
    round: number,
  ): Array<{ userId1: number; userId2: number; roomName: string }> {
    const matches: Array<{
      userId1: number;
      userId2: number;
      roomName: string;
    }> = [];
    for (const roomName of privaterooms) {
      const privateRoom = this.privateRoom.get(roomName);
      if (!privateRoom) continue;
      const members = Array.from(privateRoom.members);
      if (members.length !== 2) continue;
      const [firstUser, secondUser] = members;
      const rating = privateRoom?.ratings;
      const firstUserId = firstUser?.data.user?.id;
      const secondUserId = secondUser?.data.user?.id;
      const firstRating = firstUserId ? rating?.get(firstUserId) : undefined;
      const secondRating = secondUserId ? rating?.get(secondUserId) : undefined;
      if (
        firstUserId &&
        secondUserId &&
        firstRating !== undefined &&
        secondRating !== undefined &&
        firstRating === secondRating
      ) {
        console.log('[handleMatchRating] MATCH FOUND:', { userId1: firstUserId, userId2: secondUserId, ratings: { firstRating, secondRating }, roomName, round });
        const key = `${Math.min(firstUserId, secondUserId)}_${Math.max(firstUserId, secondUserId)}`;
        this.pendingMatches.set(key, {
          userId1: firstUserId,
          userId2: secondUserId,
          round,
        });
        matches.push({
          userId1: firstUserId,
          userId2: secondUserId,
          roomName: roomName,
        });
      }
    }
    return matches;
  }

  public addPendingMatch(userId1: number, userId2: number, round: number): void {
    const key = `${Math.min(userId1, userId2)}_${Math.max(userId1, userId2)}`;
    this.pendingMatches.set(key, { userId1, userId2, round });
  }

  public getAllPendingMatches(): Array<{ userId1: number; userId2: number }> {
    return Array.from(this.pendingMatches.values()).map((m) => ({
      userId1: m.userId1,
      userId2: m.userId2,
    }));
  }

  public clearPendingMatches(): void {
    this.pendingMatches.clear();
  }

  public registerPermanentRoom(roomId: number): void {
    this.permanentRoomDbIds.add(roomId);
  }

  public isPermanentRoom(roomId: number): boolean {
    return this.permanentRoomDbIds.has(roomId);
  }

  public async FindmatchRoom(client: Socket, gender: 'male' | 'female'): Promise<{ room: RoomData; justBecameFull: boolean } | null> {
    // 1. إذا كان النظام مشغولاً بطلب آخر، انتظر دورك في الطابور
    if (this.isLocked) {
      await new Promise<void>((resolve) => {
        // نضع دالة الـ resolve داخل الطابور، هذا يعني أن الـ await لن ينتهي
        // حتى يقوم شخص ما باستدعاء هذه الدالة من المصفوفة
        this.queue.push(resolve);
      });
    }

    // 2. قفل الحماية: الآن هذا الطلب يمتلك الحق الحصري لتعديل البيانات
    this.isLocked = true;

    try {
      const MatchRooms = Array.from(this.MatchRoomFromSocket.values());
      const freeRoom = this.findFreeMatchRoom(MatchRooms, gender);
      if (freeRoom) {
        const targetSet = gender === 'male' ? freeRoom.male : freeRoom.female;
        if (targetSet) targetSet.add(client);
        else if (gender === 'male') freeRoom.male = new Set([client]);
        else freeRoom.female = new Set([client]);
        const justBecameFull = freeRoom.female?.size === 5 && freeRoom.male?.size === 5;
        if (justBecameFull) freeRoom.full = true;
        this.MatchRooms.set(freeRoom.id, freeRoom);
        this.MatchRoomFromSocket.set(client, freeRoom);
        return { room: freeRoom, justBecameFull };
      }
      const male = gender === 'male' ? new Set([client]) : null;
      const female = gender === 'female' ? new Set([client]) : null;
      const newRoom: RoomData = { id: this.nextId++, male, female, full: false };
      this.MatchRooms.set(newRoom.id, newRoom);
      this.MatchRoomFromSocket.set(client, newRoom);
      return { room: newRoom, justBecameFull: false };
    } finally {
      // 3. فتح الحماية بعد الانتهاء تماماً
      this.isLocked = false;

      // 4. إذا كان هناك طلبات أخرى تنتظر في الطابور، اسمح للطلب التالي بالدخول
      if (this.queue.length > 0) {
        const nextRequestInQueue = this.queue.shift();
        if (nextRequestInQueue) {
          nextRequestInQueue(); // استدعاء الـ resolve للطلب التالي فيتحرر الـ await الخاص به
        }
      }
    }
  }

  public async AssignRoom(
    userId: string,
    client: Socket,
    gender: 'male' | 'female',
  ): Promise<RoomData> {
    console.log('in the assignRoom');
    // 1. إذا كان النظام مشغولاً بطلب آخر، انتظر دورك في الطابور
    if (this.isLocked) {
      await new Promise<void>((resolve) => {
        // نضع دالة الـ resolve داخل الطابور، هذا يعني أن الـ await لن ينتهي
        // حتى يقوم شخص ما باستدعاء هذه الدالة من المصفوفة
        this.queue.push(resolve);
      });
    }

    // 2. قفل الحماية: الآن هذا الطلب يمتلك الحق الحصري لتعديل البيانات
    this.isLocked = true;

    try {
      const existRoom = this.GrouproomFromSocket.get(client);
      if (existRoom) {
        const targetSet = gender === 'male' ? existRoom.male : existRoom.female;
        if (targetSet && targetSet.size < 5) {
          targetSet.add(client);
          this.GroupRooms.set(existRoom.id, existRoom);
          return existRoom;
        }
      }
      const GroupRooms = Array.from(this.GroupRooms.values());
      const freeRoom = this.findFreeGroupRoom(GroupRooms, gender);
      if (freeRoom) {
        const targetSet = gender === 'male' ? freeRoom.male : freeRoom.female;

        if (targetSet) {
          targetSet.add(client);
        } else if (gender === 'male') {
          freeRoom.male = new Set<Socket>([client]);
        } else {
          freeRoom.female = new Set<Socket>([client]);
        }
        if (freeRoom.female?.size === 5 && freeRoom.male?.size === 5)
          freeRoom.full = true;
        this.GroupRooms.set(freeRoom.id, freeRoom);
        this.GrouproomFromSocket.set(client, freeRoom);
        return freeRoom;
      }
      const male = gender === 'male' ? new Set<Socket>([client]) : null;
      const female = gender === 'female' ? new Set<Socket>([client]) : null;
      const newRoom: RoomData = {
        id: this.nextId++,
        male,
        female,
        full: false,
      };
      this.GroupRooms.set(newRoom.id, newRoom);
      this.GrouproomFromSocket.set(client, newRoom);
      return newRoom;
    } finally {
      // 3. فتح الحماية بعد الانتهاء تماماً
      this.isLocked = false;

      // 4. إذا كان هناك طلبات أخرى تنتظر في الطابور، اسمح للطلب التالي بالدخول
      if (this.queue.length > 0) {
        const nextRequestInQueue = this.queue.shift();
        if (nextRequestInQueue) {
          nextRequestInQueue(); // استدعاء الـ resolve للطلب التالي فيتحرر الـ await الخاص به
        }
      }
    }
  }

  public findFreeGroupRoom(
    Rooms: RoomData[],
    gender: 'male' | 'female',
  ): RoomData | null {
    const freeRoom = Rooms.find((room) => {
      if (gender === 'female') {
        return room.female === null || room.female.size < 5;
      }
      return room.male === null || room.male.size < 5;
    });
    if (freeRoom) return freeRoom;
    return null;
  }

  public findFreeMatchRoom(
    Rooms: RoomData[],
    gender: 'male' | 'female',
  ): RoomData | null {
    const freeRoom = Rooms.find((room) => {
      if (gender === 'female') {
        return room.female === null || room.female.size < 5;
      }
      return room.male === null || room.male.size < 5;
    });
    if (freeRoom) return freeRoom;
    return null;
  }

  public removeClientFromGroupRoom(client: Socket, gender: 'male' | 'female') {
    const room = this.getGroupRoomBySocetId(client);
    if (!room) return;
    gender === 'male' ? room.male?.delete(client) : room.female?.delete(client);
    this.GrouproomFromSocket.delete(client);
    client.to(`${room.id}`).emit(
      ServerEvents.USER_LEFT,
      {
        roomId: room.id,
        userId: client.data.user.id,
        message: `the user with id ${client.data.user.id} left the room`,
      },
    );
    if (
      (room.female?.size === 0 || !room.female) &&
      (room.male?.size === 0 || !room.male)
    ) {
      this.GroupRooms.delete(room.id);
    }
  }

  public getGroupRoomById(roomId: number) {
    return this.GroupRooms.get(roomId);
  }

  public getGroupRoomBySocetId(Socket: Socket) {
    return this.GrouproomFromSocket.get(Socket);
  }
}