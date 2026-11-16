import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './LoginDto.dto';

const validBody = {
  email: 'omar@example.com',
  password: 'password123',
};

async function validateBody(body: object) {
  const dto = plainToInstance(LoginDto, body);
  return validate(dto);
}

function invalidFields(errors: Awaited<ReturnType<typeof validateBody>>) {
  return errors.map(error => error.property);
}

describe('LoginDto', () => {
  it('should accept a valid login body', async () => {
    const errors = await validateBody(validBody);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid email', async () => {
    const errors = await validateBody({ ...validBody, email: 'omar' });

    expect(invalidFields(errors)).toContain('email');
  });

  it('should reject a password shorter than 8 characters', async () => {
    const errors = await validateBody({ ...validBody, password: 'short' });

    expect(invalidFields(errors)).toContain('password');
  });

  it('should reject a missing password', async () => {
    const { password, ...withoutPassword } = validBody;

    const errors = await validateBody(withoutPassword);

    expect(invalidFields(errors)).toContain('password');
  });

  it('should accept userName being omitted because it is optional', async () => {
    const errors = await validateBody(validBody);

    expect(invalidFields(errors)).not.toContain('userName');
  });
});
