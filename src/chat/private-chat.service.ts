import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { PrivateChatRoom } from './entity/PrivateChatRoom.entity';
import { PrivateMessage } from './entity/PrivateMessage.entity';
import { User } from 'src/users/entity/User.entity';

@Injectable()
export class PrivateChatService {
  constructor(
    @InjectRepository(PrivateChatRoom)
    private readonly roomRepo: Repository<PrivateChatRoom>,
    @InjectRepository(PrivateMessage)
    private readonly msgRepo: Repository<PrivateMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async createRoom(maleId: number, femaleId: number): Promise<PrivateChatRoom> {
    let room = await this.getRoom(maleId, femaleId);
    if (room) {
      return room;
    }

    room = this.roomRepo.create({ maleId, femaleId });
    return this.roomRepo.save(room);
  }

  async getRoom(maleId: number, femaleId: number): Promise<PrivateChatRoom | null> {
    return this.roomRepo.findOne({
      where: [
        { maleId, femaleId },
        { maleId: femaleId, femaleId: maleId },
      ],
    });
  }

  async saveMessage(
    roomId: number,
    senderId: number,
    content: string,
  ): Promise<PrivateMessage> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isParticipant =
      room.maleId === senderId || room.femaleId === senderId;
    if (!isParticipant) {
      throw new ForbiddenException('User is not a participant of this room');
    }

    const message = this.msgRepo.create({
      roomId,
      senderId,
      content,
    });

    return this.msgRepo.save(message);
  }

  async getHistory(
    roomId: number,
    userId: number,
    cursor?: Date,
    limit = 20,
  ): Promise<{
    messages: PrivateMessage[];
    hasMore: boolean;
    nextCursor: Date | null;
  }> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isParticipant = room.maleId === userId || room.femaleId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('User is not a participant of this room');
    }

    const query = this.msgRepo
      .createQueryBuilder('msg')
      .where('msg.roomId = :roomId', { roomId })
      .andWhere('msg.deletedAt IS NULL')
      .orderBy('msg.createdAt', 'DESC')
      .limit(limit + 1);

    if (cursor) {
      query.andWhere('msg.createdAt < :cursor', { cursor });
    }

    const messages = await query.getMany();
    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? resultMessages[resultMessages.length - 1].createdAt
      : null;

    return {
      messages: resultMessages.reverse(),
      hasMore,
      nextCursor,
    };
  }

  async markAsRead(
    roomId: number,
    userId: number,
    messageId?: number,
  ): Promise<void> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isParticipant = room.maleId === userId || room.femaleId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('User is not a participant of this room');
    }

    if (messageId) {
      await this.msgRepo.update(
        { id: messageId, roomId, senderId: userId },
        { readAt: new Date() },
      );
    } else {
      await this.msgRepo
        .createQueryBuilder()
        .update(PrivateMessage)
        .set({ readAt: new Date() })
        .where('roomId = :roomId', { roomId })
        .andWhere('senderId != :userId', { userId })
        .andWhere('readAt IS NULL')
        .execute();
    }
  }

  async getUnreadCount(roomId: number, userId: number): Promise<number> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isParticipant = room.maleId === userId || room.femaleId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('User is not a participant of this room');
    }

    return this.msgRepo
      .createQueryBuilder('msg')
      .where('msg.roomId = :roomId', { roomId })
      .andWhere('msg.senderId != :userId', { userId })
      .andWhere('msg.readAt IS NULL')
      .andWhere('msg.deletedAt IS NULL')
      .getCount();
  }
}