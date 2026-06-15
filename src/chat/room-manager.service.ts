import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

interface RoomData {
  id: number;
  male: Set<Socket> | null;
  female: Set<Socket> | null;
}

@Injectable()
export class RoomManger {
  private roomFromSocket = new Map<Socket, RoomData>();
  private rooms = new Map<number, RoomData>(); //RoomId, male/famle Set
  private nextId = 1;

  public AssignRoom(
    userId: string,
    client: Socket,
    gender: 'male' | 'female',
  ): RoomData {
    const existRoom = this.roomFromSocket.get(client);
    // console.log('client in assignRoom', client);
    if (existRoom) {
      const targetSet = gender === 'male' ? existRoom.male : existRoom.female;
      if (targetSet && targetSet.size < 5) {
        targetSet.add(client);
        this.rooms.set(existRoom.id, existRoom);
        console.log('exist room the roomMap ', this.rooms);
        return existRoom;
      }
    }
    // if there a free room
    const Rooms: RoomData[] = Array.from(this.rooms.values());
    const freeRoom: RoomData | null = this.findFreeRoom(Rooms, gender);
    if (freeRoom) {
      const targetSet = gender === 'male' ? freeRoom.male : freeRoom.female;

      if (targetSet) {
        targetSet.add(client);
      } else if (gender === 'male') {
        freeRoom.male = new Set<Socket>([client]);
      } else {
        freeRoom.female = new Set<Socket>([client]);
      }

      this.rooms.set(freeRoom.id, freeRoom);
      this.roomFromSocket.set(client, freeRoom);
      console.log('there is free room the roomMap ', this.rooms);
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
    };
    this.rooms.set(newRoom.id, newRoom);
    this.roomFromSocket.set(client, newRoom);
    console.log('new Room the roomMap ', this.rooms);
    return newRoom;
  }

  public findFreeRoom(
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

  public removeClient(client: Socket, gender: 'male' | 'female') {
    const room = this.getRoomBySocetId(client);
    if (!room) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    gender === 'male' ? room.male?.delete(client) : room.female?.delete(client);
    this.roomFromSocket.delete(client);
    console.log(
      `the user with id ${client.data.user.id} is removed from the Room with id ${room.id}`,
    );
    console.log('rrrrrrrrrrrrr', room.female?.size, room.male?.size);
    if (
      (room.female?.size === 0 || !room.female) &&
      (room.male?.size === 0 || !room.male)
    ) {
      this.rooms.delete(room.id);
      console.log(`the Room with id ${room.id} removed`);
    }
  }

  public getRoomById(roomId: number) {
    return this.rooms.get(roomId);
  }
  public getRoomBySocetId(Socket: Socket) {
    return this.roomFromSocket.get(Socket);
  }
}
