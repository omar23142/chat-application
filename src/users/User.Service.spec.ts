// Replace the real password hasher with fast, predictable fakes.
jest.mock('bcryptjs', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from './User.Service';
import { User } from './entity/User.entity';
import { AuthProvider } from '../auth/providers/auth.provider';
import { MailService } from '../mail/mail.service';

describe('UserService', () => {
  let service: UserService;

  // Fake database repository. Every method is a jest mock.
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  // Fake in-memory cache.
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    wrap: jest.fn(),
  };

  const authProvider = {
    sigup: jest.fn(),
    login: jest.fn(),
    logOut: jest.fn(),
  };

  const mailService = {
    sendValidationEmail: jest.fn(),
  };

  const config = {
    get: jest.fn(),
  };

  /** Build the UserService with every dependency replaced by a fake. */
  async function createService() {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: AuthProvider, useValue: authProvider },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: ConfigService, useValue: config },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    return module.get(UserService);
  }

  beforeEach(async () => {
    // Start every test from a clean slate.
    Object.values(repo).forEach(mock => (mock as jest.Mock).mockReset());
    Object.values(cache).forEach(mock => (mock as jest.Mock).mockReset());
    Object.values(authProvider).forEach(mock =>
      (mock as jest.Mock).mockReset()
    );
    Object.values(mailService).forEach(mock =>
      (mock as jest.Mock).mockReset()
    );
    (config.get as jest.Mock).mockReset();

    (bcrypt.genSalt as jest.Mock).mockReset().mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock)
      .mockReset()
      .mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockReset();

    service = await createService();
  });

  describe('getOne', () => {
    it('should return the user when they exist', async () => {
      const user = { id: 1, email: 'omar@example.com' };
      repo.findOneBy.mockResolvedValue(user);

      await expect(service.getOne(1)).resolves.toEqual(user);
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.getOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAll', () => {
    it('should return cached users without querying the database', async () => {
      const cachedUsers = [{ id: 1 }];
      cache.wrap.mockResolvedValue(cachedUsers);

      await expect(service.getAll()).resolves.toEqual(cachedUsers);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('should hide secrets when loading users from the database', async () => {
      const user = {
        id: 1,
        password: 'secret',
        ResetPassToken: 'reset',
        verificationToken: 'verify',
      };

      // Simulate a cache miss: `wrap` calls the loader function.
      cache.wrap.mockImplementation(async (_key: string, loader: () => Promise<any>) =>
        loader()
      );
      repo.find.mockResolvedValue([user]);

      const result = await service.getAll();

      expect(result[0]).toEqual(
        expect.objectContaining({
          password: '',
          ResetPassToken: '',
          verificationToken: '',
        })
      );
    });
  });

  describe('sigup (delegation)', () => {
    it('should forward the request to AuthProvider.signup', async () => {
      const body = { email: 'omar@example.com' } as any;
      const req = {} as any;
      authProvider.sigup.mockResolvedValue({ message: 'verification sent' });

      const result = await service.sigup(body, req);

      expect(authProvider.sigup).toHaveBeenCalledWith(body, req);
      expect(result).toEqual({ message: 'verification sent' });
    });
  });

  describe('login (delegation)', () => {
    it('should forward the request to AuthProvider.login', async () => {
      const body = { email: 'omar@example.com' } as any;
      const req = {} as any;
      authProvider.login.mockResolvedValue({ accessToken: 'token' });

      const result = await service.login(body, req);

      expect(authProvider.login).toHaveBeenCalledWith(body, req);
      expect(result).toEqual({ accessToken: 'token' });
    });
  });

  describe('updateOne', () => {
    it('should throw ForbiddenException when the user no longer exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.updateOne({ userName: 'new' } as any, 1)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update only the fields that were provided', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        userName: 'old',
        email: 'old@example.com',
        photo: null,
        nativeLanguage: 'Arabic',
        gender: 'male',
      });

      const result = await service.updateOne({ userName: 'new' } as any, 1);

      expect(result.userName).toBe('new');
      expect(result.email).toBe('old@example.com');
      expect(cache.del).toHaveBeenCalledWith('$/api/v1/users/me:1');
    });
  });

  describe('changePassword', () => {
    function mockUserLookup(user: any) {
      repo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      });
    }

    it('should throw NotFoundException when the user does not exist', async () => {
      mockUserLookup(null);

      await expect(
        service.changePassword({ currentPassword: 'old' } as any, 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when the current password is wrong', async () => {
      mockUserLookup({ id: 1, password: 'hashed-old' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(
          {
            currentPassword: 'wrong',
            newPassword: 'newPassword123',
            newPasswordConfirm: 'newPassword123',
          } as any,
          1
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when the confirmation does not match', async () => {
      mockUserLookup({ id: 1, password: 'hashed-old' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword(
          {
            currentPassword: 'old',
            newPassword: 'newPassword123',
            newPasswordConfirm: 'different123',
          } as any,
          1
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should save the new password and log the user out', async () => {
      const user = { id: 1, password: 'hashed-old' };
      mockUserLookup(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      repo.save.mockResolvedValue(user);

      const result = await service.changePassword(
        {
          currentPassword: 'old',
          newPassword: 'newPassword123',
          newPasswordConfirm: 'newPassword123',
        } as any,
        1
      );

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(authProvider.logOut).toHaveBeenCalledWith(user);
      expect(result).toEqual({ message: 'Password updated successfully' });
    });
  });

  describe('VerifyEmail', () => {
    it('should throw NotFoundException when there is no verification token', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, verificationToken: null });

      await expect(service.VerifyEmail(1, 'token')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when the token is invalid', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, verificationToken: 'correct' });

      await expect(service.VerifyEmail(1, 'wrong')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should verify the user when the token matches', async () => {
      const user = {
        id: 1,
        verificationToken: 'correct',
        isVerified: false,
      };
      repo.findOneBy.mockResolvedValue(user);
      repo.save.mockResolvedValue(user);

      const result = await service.VerifyEmail(1, 'correct');

      expect(user.isVerified).toBe(true);
      expect(user.verificationToken).toBeNull();
      expect(result.message).toContain('verified');
    });
  });

  describe('deleteMe', () => {
    it('should throw ForbiddenException when the user does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.deleteMe(1)).rejects.toThrow(ForbiddenException);
    });

    it('should remove the user', async () => {
      const user = { id: 1 };
      repo.findOneBy.mockResolvedValue(user);
      repo.remove.mockResolvedValue(user);

      await expect(service.deleteMe(1)).resolves.toBe(
        'user is deleted successfuly'
      );
      expect(repo.remove).toHaveBeenCalledWith(user);
    });
  });

  describe('presence helpers', () => {
    it('should mark the user offline only when the socket id matches', async () => {
      repo.findOne.mockResolvedValue({ id: 1, socketId: 'socket-1' });
      repo.update.mockResolvedValue({});

      await service.setOffline(1, 'socket-1');

      expect(repo.update).toHaveBeenCalledWith(1, {
        isOnline: false,
        socketId: null,
        lastSeen: expect.any(Date),
      });
    });

    it('should ignore setOffline when another socket is active', async () => {
      repo.findOne.mockResolvedValue({ id: 1, socketId: 'socket-2' });

      await service.setOffline(1, 'socket-1');

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should return the socket id when the user is online', async () => {
      repo.findOne.mockResolvedValue({ isOnline: true, socketId: 'socket-1' });

      await expect(service.getSocketIds(1)).resolves.toEqual(['socket-1']);
    });

    it('should return an empty list when the user is offline', async () => {
      repo.findOne.mockResolvedValue({ isOnline: false, socketId: 'socket-1' });

      await expect(service.getSocketIds(1)).resolves.toEqual([]);
    });

    it('should report isOnline false when the user is missing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.isOnline(1)).resolves.toBe(false);
    });
  });
});
