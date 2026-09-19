

import { Injectable, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import DataLoader from 'dataloader';
import { User } from 'src/users/entity/User.entity';
import { PrivateChatRoom } from 'src/chat/entity/PrivateChatRoom.entity';

@Injectable({ scope: Scope.REQUEST })  // ⬅️ جديد!scoped لكل request
export class DataLoaderService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PrivateChatRoom)
    private readonly roomRepo: Repository<PrivateChatRoom>,
  ) {}

  // ┌──────────────────────────────────────────────┐
  // │ DataLoader for Users                         │
  // │ يجمع كل senderIds → query واحد → يرتبهم     │
  // └──────────────────────────────────────────────┘
  private readonly userLoader = new DataLoader<number, User>(
    async (ids: readonly number[]) => {
      console.log(`📦 BATCH loading users: [${ids}] ← query واحد بدل ${ids.length}!`);
      
      const users = await this.userRepo.findBy({ id: In(ids as number[]) });
      
      // ⚠️ DataLoader يتطلب أن النتيجة تكون بالترتيب نفس ids
      const userMap = new Map(users.map(u => [u.id, u]));
      return ids.map(id => userMap.get(id)!);
    },
  );

  // ┌──────────────────────────────────────────────┐
  // │ DataLoader for Rooms                         │
  // │ يجمع كل roomIds → query واحد → يرتبهم       │
  // └──────────────────────────────────────────────┘
  private readonly roomLoader = new DataLoader<number, PrivateChatRoom>(
    async (ids: readonly number[]) => {
      console.log(`📦 BATCH loading rooms: [${ids}] ← query واحد بدل ${ids.length}!`);
      
      const rooms = await this.roomRepo.findBy({ id: In(ids as number[]) });
      
      const roomMap = new Map(rooms.map(r => [r.id, r]));
      return ids.map(id => roomMap.get(id)!);
    },
  );

  getUserById(id: number): Promise<User> {
    return this.userLoader.load(id);
  }

  getRoomById(id: number): Promise<PrivateChatRoom> {
    return this.roomLoader.load(id);
  }
}