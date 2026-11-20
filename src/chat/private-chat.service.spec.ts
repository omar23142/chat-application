import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrivateChatService } from './private-chat.service';
import { PrivateChatRoom } from './entity/PrivateChatRoom.entity';
import { PrivateMessage } from './entity/PrivateMessage.entity';
import { User } from '../users/entity/User.entity';

describe('PrivateChatService', () => {
  let service: PrivateChatService;

  const roomRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const msgRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  /** A chainable fake for TypeORM's createQueryBuilder(). */
  function mockQueryBuilder(overrides: Record<string, any> = {}) {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      ...overrides,
    };

    msgRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    return queryBuilder;
  }

  beforeEach(async () => {
    Object.values(roomRepo).forEach(mock => (mock as jest.Mock).mockReset());
    Object.values(msgRepo).forEach(mock => (mock as jest.Mock).mockReset());

    const module = await Test.createTestingModule({
      providers: [
        PrivateChatService,
        { provide: getRepositoryToken(PrivateChatRoom), useValue: roomRepo },
        { provide: getRepositoryToken(PrivateMessage), useValue: msgRepo },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    service = module.get(PrivateChatService);
  });

  describe('createRoom', () => {
    it('should return an existing room instead of creating a duplicate', async () => {
      const existing = { id: 1, maleId: 1, femaleId: 2 };
      roomRepo.findOne.mockResolvedValue(existing);

      const result = await service.createRoom(1, 2);

      expect(result).toBe(existing);
      expect(roomRepo.save).not.toHaveBeenCalled();
    });

    it('should create and save a new room', async () => {
      const newRoom = { id: 5, maleId: 1, femaleId: 2 };
      roomRepo.findOne.mockResolvedValue(null);
      roomRepo.create.mockReturnValue(newRoom);
      roomRepo.save.mockResolvedValue(newRoom);

      const result = await service.createRoom(1, 2);

      expect(roomRepo.create).toHaveBeenCalledWith({ maleId: 1, femaleId: 2 });
      expect(result).toBe(newRoom);
    });
  });

  describe('getRoomById', () => {
    it('should throw NotFoundException when the room does not exist', async () => {
      roomRepo.findOne.mockResolvedValue(null);

      await expect(service.getRoomById(1)).rejects.toThrow(NotFoundException);
    });

    it('should return the room when it exists', async () => {
      const room = { id: 1 };
      roomRepo.findOne.mockResolvedValue(room);

      await expect(service.getRoomById(1)).resolves.toBe(room);
    });
  });

  describe('saveMessage', () => {
    it('should throw NotFoundException when the room does not exist', async () => {
      roomRepo.findOne.mockResolvedValue(null);

      await expect(service.saveMessage(1, 1, 'hello')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException when the sender is not a participant', async () => {
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });

      await expect(service.saveMessage(1, 99, 'hello')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should save the message for a participant', async () => {
      const message = { id: 1, roomId: 1, senderId: 1, content: 'hello' };
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });
      msgRepo.create.mockReturnValue(message);
      msgRepo.save.mockResolvedValue(message);

      const result = await service.saveMessage(1, 1, 'hello');

      expect(msgRepo.create).toHaveBeenCalledWith({
        roomId: 1,
        senderId: 1,
        content: 'hello',
      });
      expect(result).toBe(message);
    });
  });

  describe('getHistory', () => {
    it('should throw NotFoundException when the room does not exist', async () => {
      roomRepo.findOne.mockResolvedValue(null);

      await expect(service.getHistory(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for a non-participant', async () => {
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });

      await expect(service.getHistory(1, 99)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should paginate and report that more messages exist', async () => {
      const messages = Array.from({ length: 21 }, (_, index) => ({
        id: index + 1,
        createdAt: new Date(2026, 0, index + 1),
      }));
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });
      const queryBuilder = mockQueryBuilder();
      queryBuilder.getMany.mockResolvedValue(messages);

      const result = await service.getHistory(1, 1);

      expect(result.messages).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toEqual(messages[19].createdAt);
      expect(queryBuilder.limit).toHaveBeenCalledWith(21);
    });

    it('should return messages oldest-first and no cursor on the last page', async () => {
      const messages = [
        { id: 1, createdAt: new Date(2026, 0, 1) },
        { id: 2, createdAt: new Date(2026, 0, 2) },
        { id: 3, createdAt: new Date(2026, 0, 3) },
      ];
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });
      const queryBuilder = mockQueryBuilder();
      queryBuilder.getMany.mockResolvedValue(messages);

      const result = await service.getHistory(1, 1);

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.messages.map(message => message.id)).toEqual([3, 2, 1]);
    });
  });

  describe('markAsRead', () => {
    it('should throw NotFoundException when the room does not exist', async () => {
      roomRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for a non-participant', async () => {
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });

      await expect(service.markAsRead(1, 99)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should mark a single message as read', async () => {
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });
      msgRepo.update.mockResolvedValue({ affected: 1 });

      await service.markAsRead(1, 1, 5);

      expect(msgRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, roomId: 1 }),
        { readAt: expect.any(Date) }
      );
    });

    it('should mark every incoming message as read when no id is given', async () => {
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });
      const queryBuilder = mockQueryBuilder();

      await service.markAsRead(1, 1);

      expect(queryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should throw NotFoundException when the room does not exist', async () => {
      roomRepo.findOne.mockResolvedValue(null);

      await expect(service.getUnreadCount(1, 1)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException for a non-participant', async () => {
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });

      await expect(service.getUnreadCount(1, 99)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should return the unread count for a participant', async () => {
      roomRepo.findOne.mockResolvedValue({ id: 1, maleId: 1, femaleId: 2 });
      const queryBuilder = mockQueryBuilder();
      queryBuilder.getCount.mockResolvedValue(3);

      await expect(service.getUnreadCount(1, 1)).resolves.toBe(3);
    });
  });

  describe('getMessages', () => {
    it('should return all messages sent by the user', async () => {
      const messages = [{ id: 1 }, { id: 2 }];
      msgRepo.find.mockResolvedValue(messages);

      await expect(service.getMessages(1)).resolves.toBe(messages);
      expect(msgRepo.find).toHaveBeenCalledWith({
        where: [{ senderId: 1 }],
      });
    });
  });
});
