// Replace bcrypt with fast fakes so tests stay deterministic.
jest.mock('bcryptjs', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { AuthProvider } from './auth.provider';
import { User } from '../../users/entity/User.entity';
import { MailService } from '../../mail/mail.service';

describe('AuthProvider', () => {
  let service: AuthProvider;

  const repo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const jwtService = { signAsync: jest.fn() };
  const config = { get: jest.fn() };
  const mailerService = { sendMail: jest.fn() };
  const mailService = { sendValidationEmail: jest.fn() };

  const req = {
    protocol: 'http',
    get: jest.fn(() => 'localhost:3000'),
  } as any;

  const signupBody = {
    email: 'omar@example.com',
    userName: 'omar',
    password: 'password123',
    passwordConf: 'password123',
    nativeLanguage: 'Arabic',
    gender: 'male',
  } as any;

  const baseUser = {
    id: 1,
    role: 'NORMAL_USER',
    userName: 'omar',
    email: 'omar@example.com',
    password: 'hashed-password',
    accessTokenVersion: 1,
    gender: 'male',
    isVerified: true,
    verificationToken: 'verify-token',
    refreshToken: null,
  } as any;

  /** Fake the TypeORM query used to load a user by email. */
  function mockUserLookup(found: any) {
    repo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(found),
    });
  }

  beforeEach(async () => {
    Object.values(repo).forEach(mock => (mock as jest.Mock).mockReset());
    Object.values(jwtService).forEach(mock => (mock as jest.Mock).mockReset());
    Object.values(config).forEach(mock => (mock as jest.Mock).mockReset());
    Object.values(mailerService).forEach(mock =>
      (mock as jest.Mock).mockReset()
    );
    Object.values(mailService).forEach(mock => (mock as jest.Mock).mockReset());

    // bcrypt fakes
    (bcrypt.genSalt as jest.Mock).mockReset().mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockReset().mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockReset();

    // Config values used by the token methods
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'JWT_EXPIRES_IN') return '1h';
      if (key === 'Refresh_JWT_EXPIRES_IN') return '7d';
      return 'test-secret';
    });

    const module = await Test.createTestingModule({
      providers: [
        AuthProvider,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: MailerService, useValue: mailerService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get(AuthProvider);
  });

  describe('sigup', () => {
    it('should reject a duplicate email', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 2, email: signupBody.email });

      await expect(service.sigup(signupBody, req)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject a duplicate username', async () => {
      repo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2, userName: signupBody.userName });

      await expect(service.sigup(signupBody, req)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject when password and confirmation do not match', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.sigup({ ...signupBody, passwordConf: 'different123' }, req)
      ).rejects.toThrow(BadRequestException);
    });

    it('should create the user, send a verification email, and return a JWT', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((data: any) => ({ ...baseUser, ...data }));
      repo.save.mockImplementation(async (user: any) => user);
      jwtService.signAsync.mockResolvedValue('jwt-token');
      mailService.sendValidationEmail.mockResolvedValue(undefined);

      const result = await service.sigup(signupBody, req);

      expect(result.jwtToken).toBe('jwt-token');
      expect(result.newUser.password).toBe('');
      expect(mailService.sendValidationEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('should reject when the user does not exist', async () => {
      mockUserLookup(null);

      await expect(
        service.login({ email: 'x@example.com' } as any, req)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when the password is wrong', async () => {
      mockUserLookup(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: baseUser.email, password: 'wrong' } as any, req)
      ).rejects.toThrow(BadRequestException);
    });

    it('should resend the verification email when the user is not verified', async () => {
      mockUserLookup({ ...baseUser, isVerified: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mailService.sendValidationEmail.mockResolvedValue(undefined);

      const result: any = await service.login(
        { email: baseUser.email, password: 'password123' } as any,
        req
      );

      expect(mailService.sendValidationEmail).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('verifycation email');
      expect(result.accessToken).toBeUndefined();
    });

    it('should return an access token when the credentials are valid', async () => {
      mockUserLookup(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.login(
        { email: baseUser.email, password: 'password123' } as any,
        req
      );

      expect(result).toEqual({ accessToken: 'access-token' });
    });
  });

  describe('validateLocalUser', () => {
    it('should return null when the user does not exist', async () => {
      mockUserLookup(null);

      await expect(
        service.validateLocalUser('x@example.com', 'password123')
      ).resolves.toBeNull();
    });

    it('should return null when the password is wrong', async () => {
      mockUserLookup(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateLocalUser(baseUser.email, 'wrong')
      ).resolves.toBeNull();
    });

    it('should return the user without the password hash when valid', async () => {
      mockUserLookup(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateLocalUser(
        baseUser.email,
        'password123'
      );

      expect(result?.password).toBe('');
    });
  });

  describe('token generation', () => {
    it('should generate a JWT for the user', async () => {
      jwtService.signAsync.mockResolvedValue('jwt-token');

      await expect(service.generateJwtForUser(baseUser)).resolves.toBe(
        'jwt-token'
      );
    });

    it('should generate a refresh token and store its hash', async () => {
      jwtService.signAsync.mockResolvedValue('refresh-token');
      repo.update.mockResolvedValue({});

      const token = await service.generateRefreshToken(baseUser);

      const expectedHash = createHash('sha256')
        .update('refresh-token')
        .digest('hex');

      expect(token).toBe('refresh-token');
      expect(repo.update).toHaveBeenCalledWith(baseUser.id, {
        refreshToken: expectedHash,
      });
    });
  });

  describe('validateHashedRefreshToken', () => {
    it('should reject when the user has no stored refresh token', async () => {
      await expect(
        service.validateHashedRefreshToken(baseUser, 'refresh-token')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should revoke the session when the token does not match', async () => {
      const user = { ...baseUser, refreshToken: 'some-other-hash' };
      repo.update.mockResolvedValue({});
      repo.increment.mockResolvedValue({});

      await expect(
        service.validateHashedRefreshToken(user, 'refresh-token')
      ).rejects.toThrow(UnauthorizedException);

      expect(repo.update).toHaveBeenCalledWith(user.id, {
        refreshToken: null,
      });
      expect(repo.increment).toHaveBeenCalled();
    });

    it('should return true when the token matches the stored hash', async () => {
      const storedHash = createHash('sha256')
        .update('refresh-token')
        .digest('hex');
      const user = { ...baseUser, refreshToken: storedHash };

      await expect(
        service.validateHashedRefreshToken(user, 'refresh-token')
      ).resolves.toBe(true);
    });
  });

  describe('logOut', () => {
    it('should clear the refresh token and bump the token version', async () => {
      repo.update.mockResolvedValue({});
      repo.increment.mockResolvedValue({});

      const result = await service.logOut(baseUser);

      expect(repo.update).toHaveBeenCalledWith(baseUser.id, {
        refreshToken: null,
      });
      expect(repo.increment).toHaveBeenCalledWith(
        { id: baseUser.id },
        'accessTokenVersion',
        1
      );
      expect(result).toEqual({ message: 'you are logout sucessfully' });
    });
  });

  describe('signin', () => {
    it('should return both tokens for a verified user', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      repo.update.mockResolvedValue({});

      const result = await service.signin(baseUser, req);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: baseUser,
      });
    });
  });
});
