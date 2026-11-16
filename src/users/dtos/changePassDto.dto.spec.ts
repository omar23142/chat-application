import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangPassDto } from './changePassDto.dto';

const validBody = {
  currentPassword: 'oldPassword123',
  newPassword: 'newPassword123',
  newPasswordConfirm: 'newPassword123',
};

async function validateBody(body: object) {
  const dto = plainToInstance(ChangPassDto, body);
  return validate(dto);
}

function invalidFields(errors: Awaited<ReturnType<typeof validateBody>>) {
  return errors.map(error => error.property);
}

describe('ChangPassDto', () => {
  it('should accept a valid change-password body', async () => {
    const errors = await validateBody(validBody);

    expect(errors).toHaveLength(0);
  });

  it('should reject a new password shorter than 8 characters', async () => {
    const errors = await validateBody({ ...validBody, newPassword: '123' });

    expect(invalidFields(errors)).toContain('newPassword');
  });

  it('should reject a missing current password', async () => {
    const { currentPassword, ...withoutCurrentPassword } = validBody;

    const errors = await validateBody(withoutCurrentPassword);

    expect(invalidFields(errors)).toContain('currentPassword');
  });

  it('should reject a missing confirmation password', async () => {
    const { newPasswordConfirm, ...withoutConfirmation } = validBody;

    const errors = await validateBody(withoutConfirmation);

    expect(invalidFields(errors)).toContain('newPasswordConfirm');
  });
});
