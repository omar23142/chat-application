import { Injectable } from '@nestjs/common';
import { ContextUtils } from '@nestjs/core/helpers/context-utils';
import { Server, Socket } from 'socket.io';

interface RoomData {
  id: number;
  male: Set<Socket> | null;
  female: Set<Socket> | null;
  full: boolean;
}

interface PrivateRoomData {
  members: Set<Socket>;
  ratings: Map<string, number>; // userId -> rating (1-5)
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
  private privateRoom = new Map<string, PrivateRoomData>();
  private PrivateRoomFromSocket = new Map<Socket, string>();
  private MatchRooms = new Map<number, RoomData>();
  private MatchRoomFromSocket = new Map<Socket, RoomData>();
  private pendingMatches = new Map<string, PendingMatch>();
  private nextId = 1;

  public CreatePrivateChatRoom(firstClient: Socket, secondClient: Socket) {
    // console.log('from serviceeeee', firstClient, secondClient);
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
      firstClient.emit('roomAssigned', {
        roomId: PrivatRoomName,
        partnerId: secondClient.data.user.id,
      });
      secondClient.emit('roomAssigned', {
        roomId: PrivatRoomName,
        partnerId: firstClient.data.user.id,
      });
    }, 200);
    return PrivatRoomName;
  }

  public removeClientFromPrivateRoom(first: Socket) {
    console.log('in the removefromprivateRoom');
    const Room = this.PrivateRoomFromSocket.get(first);
    if (!Room) return;
    const privateRoomData = this.privateRoom.get(Room);
    if (!privateRoomData) return;
    const members = privateRoomData.members;
    const second = members
      ? Array.from(members).find((member) => member !== first)
      : undefined;
    first.to(Room).emit('partnerLeft', { roomId: Room });
    this.PrivateRoomFromSocket.delete(first);
    if (second) {
      this.PrivateRoomFromSocket.delete(second);
    }
    first.leave(Room);
    second?.leave(Room);
    this.privateRoom.delete(Room);
    console.log(
      `the user with id ${first.data.user.id} is removed from room
      ,the room with id ${Room} is deleted`,
      // this.privateRoom,
    );
  }
  public DestroyPrivateRoom(rooms: string[]) {
    console.log('in the DestroyPrivateRoom');
    for (const room of rooms) {
      const privateRoomData = this.privateRoom.get(room);
      if (!privateRoomData) continue;
      const members = privateRoomData.members;
      if (!members || members.size === 0) continue;
      const [first, second] = Array.from(members);

      first.to(room).emit('partnerLeft', { roomId: room });
      this.PrivateRoomFromSocket.delete(first);
      if (second) {
        this.PrivateRoomFromSocket.delete(second);
      }
      first.leave(room);
      second?.leave(room);
      this.privateRoom.delete(room);
      console.log(
        `the user with id ${first.data.user.id} is removed from room
      ,the room with id ${room} is deleted`,
        // this.privateRoom,
      );
    }
  }

  public handleRating(client: Socket, rating: number): void {
    // Validate rating (assuming 1-5 scale)
    if (rating < 1 || rating > 5) {
      console.log(
        `Invalid rating value: ${rating}. Rating must be between 1 and 5.`,
      );
      client.emit('ratingError', { message: 'Rating must be between 1 and 5' });
      return;
    }

    const roomName = this.PrivateRoomFromSocket.get(client);
    if (!roomName) {
      console.log('Client not in any private room');
      client.emit('ratingError', { message: 'You are not in a private room' });
      return;
    }

    const privateRoomData = this.privateRoom.get(roomName);
    if (!privateRoomData) {
      console.log('Private room not found');
      client.emit('ratingError', { message: 'Private room not found' });
      return;
    }

    const userId = client.data.user?.id;
    if (!userId) {
      console.log('User ID not found on client');
      client.emit('ratingError', { message: 'User not authenticated' });
      return;
    }

    // Store the rating
    privateRoomData.ratings.set(userId, rating);
    console.log(
      `Rating stored for user ${userId} in room ${roomName}: ${rating}`,
    );

    // Check if both users have rated
    const members = Array.from(privateRoomData.members);
    if (members.length === 2) {
      const [firstUser, secondUser] = members;
      const firstUserId = firstUser.data.user?.id;
      const secondUserId = secondUser.data.user?.id;

      if (firstUserId && secondUserId) {
        const firstHasRated = privateRoomData.ratings.has(firstUserId);
        const secondHasRated = privateRoomData.ratings.has(secondUserId);

        if (firstHasRated && secondHasRated) {
          console.log(
            `Both users have rated in room ${roomName}. Destroying room.`,
          );
          // Emit ratings to both users before destroying the room
          const firstRating = privateRoomData.ratings.get(firstUserId) || 0;
          const secondRating = privateRoomData.ratings.get(secondUserId) || 0;

          firstUser.emit('ratingComplete', {
            roomId: roomName,
            yourRating: firstRating,
            partnerRating: secondRating,
          });

          secondUser.emit('ratingComplete', {
            roomId: roomName,
            yourRating: secondRating,
            partnerRating: firstRating,
          });
          setTimeout(() => {
            this.DestroyPrivateRoom([roomName]);
          }, 500);
        } else {
          // Let the user know their rating was recorded and we're waiting for the partner
          const partnerHasRated =
            firstUserId === userId ? secondHasRated : firstHasRated;
          client.emit('ratingRecorded', {
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
      const privateRoom: PrivateRoomData | undefined =
        this.privateRoom.get(roomName);
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
  public FindmatchRoom(client: Socket, gender: 'male' | 'female') {
    // if there a free room
    const MatchRooms: RoomData[] = Array.from(
      this.MatchRoomFromSocket.values(),
    );
    const freeRoom: RoomData | null = this.findFreeMatchRoom(
      MatchRooms,
      gender,
    );
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
      this.MatchRooms.set(freeRoom.id, freeRoom);
      this.MatchRoomFromSocket.set(client, freeRoom);
      console.log('there is free room the roomMap ', this.MatchRooms);
      return freeRoom;
    }
    // if no free room make new one
    const male = gender === 'male' ? new Set<Socket>([client]) : null;
    const female = gender === 'female' ? new Set<Socket>([client]) : null;
    // console.log('ggggggggggggg', male, female, gender);
    const newRoom: RoomData = {
      id: this.nextId++,
      male,
      female,
      full: false,
    };
    this.MatchRooms.set(newRoom.id, newRoom);
    this.MatchRoomFromSocket.set(client, newRoom);
    console.log('new Room the roomMap ', this.GroupRooms);
    return newRoom;
  }

  public AssignRoom(
    userId: string,
    client: Socket,
    gender: 'male' | 'female',
  ): RoomData {
    const existRoom = this.GrouproomFromSocket.get(client);
    // console.log('client in assignRoom', client);
    if (existRoom) {
      const targetSet = gender === 'male' ? existRoom.male : existRoom.female;
      if (targetSet && targetSet.size < 5) {
        targetSet.add(client);
        this.GroupRooms.set(existRoom.id, existRoom);
        console.log('exist room the roomMap ', this.GroupRooms);
        return existRoom;
      }
    }
    // if there a free room
    const GroupRooms: RoomData[] = Array.from(this.GroupRooms.values());
    const freeRoom: RoomData | null = this.findFreeGroupRoom(
      GroupRooms,
      gender,
    );
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
      console.log('there is free room the roomMap ', this.GroupRooms);
      return freeRoom;
    }
    // if no free room make new one
    const male = gender === 'male' ? new Set<Socket>([client]) : null;
    const female = gender === 'female' ? new Set<Socket>([client]) : null;
    // console.log('ggggggggggggg', male, female, gender);
    const newRoom: RoomData = {
      id: this.nextId++,
      male,
      female,
      full: false,
    };
    this.GroupRooms.set(newRoom.id, newRoom);
    this.GrouproomFromSocket.set(client, newRoom);
    console.log('new Room the roomMap ', this.GroupRooms);
    return newRoom;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    gender === 'male' ? room.male?.delete(client) : room.female?.delete(client);
    this.GrouproomFromSocket.delete(client);
    console.log(
      `the user with id ${client.data.user.id} is removed from the Room with id ${room.id}`,
    );
    client
      .to(`${room.id}`)
      .emit(
        'roomAssigned',
        `the user with id ${client.data.user.id} is left the room`,
      );
    console.log('rrrrrrrrrrrrr', room.female?.size, room.male?.size);
    if (
      (room.female?.size === 0 || !room.female) &&
      (room.male?.size === 0 || !room.male)
    ) {
      this.GroupRooms.delete(room.id);
      console.log(`the Room with id ${room.id} removed`);
    }
  }

  public getGroupRoomById(roomId: number) {
    return this.GroupRooms.get(roomId);
  }
  public getGroupRoomBySocetId(Socket: Socket) {
    return this.GrouproomFromSocket.get(Socket);
  }
}
