import { RequestTimeoutException } from '@nestjs/common';
import { MailService } from './mail.service';
import { User } from '../users/entity/User.entity';

/**
 * MailService only depends on MailerService, so we can pass a fake directly.
 * No Nest module is needed for a class with one simple dependency.
 */
describe('MailService', () => {
  let service: MailService;
  let mailerService: { sendMail: jest.Mock };

  const user = {
    id: 1,
    userName: 'Omar Alm',
    email: 'omar@example.com',
  } as User;

  beforeEach(() => {
    mailerService = { sendMail: jest.fn().mockResolvedValue({ accepted: [user.email] }) };
    service = new MailService(mailerService as any);
  });

  it('should send a welcome email with the user first name', async () => {
    await service.sendWelcome(user, 'http://localhost/upload');

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'omar@example.com',
        template: 'welcome',
        context: expect.objectContaining({ firstname: 'Omar' }),
      })
    );
  });

  it('should send a reset-password email with the reset url', async () => {
    await service.sendResetPassword(user, 'http://localhost/reset?token=abc');

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'resetPass',
        context: expect.objectContaining({
          url: 'http://localhost/reset?token=abc',
        }),
      })
    );
  });

  it('should send a validation email with the validation url', async () => {
    await service.sendValidationEmail(user, 'http://localhost/verify/abc');

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'validation',
        context: expect.objectContaining({
          url: 'http://localhost/verify/abc',
        }),
      })
    );
  });

  it('should throw RequestTimeoutException when the mail provider fails', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('SMTP is down'));

    await expect(service.sendWelcome(user)).rejects.toThrow(
      RequestTimeoutException
    );
  });
});
