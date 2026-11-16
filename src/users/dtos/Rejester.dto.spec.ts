import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RejesterDto } from './Rejester.dto';

/**
 * A valid signup body we can copy and mutate in each test.
 */
const validBody = {
  email: 'omar@example.com',
  userName: 'omar',
  password: 'password123',
  passwordConf: 'password123',
  nativeLanguage: 'Arabic',
  gender: 'male',
};

/**
 * class-validator works on class instances, not plain objects.
 * `plainToInstance` builds the DTO instance, then `validate` runs the decorators.
 */
async function validateBody(body: object) {
  const dto = plainToInstance(RejesterDto, body);
  return validate(dto);
}

/** Returns the list of field names that failed validation. */
function invalidFields(errors: Awaited<ReturnType<typeof validateBody>>) {
  return errors.map(error => error.property);
}

describe('RejesterDto', () => {
  it('should accept a valid signup body', async () => {
    const errors = await validateBody(validBody);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid email', async () => {
    const errors = await validateBody({ ...validBody, email: 'not-an-email' });

    expect(invalidFields(errors)).toContain('email');
  });

  it('should reject a password shorter than 8 characters', async () => {
    const errors = await validateBody({ ...validBody, password: '123' });

    expect(invalidFields(errors)).toContain('password');
  });

  it('should reject a missing required field', async () => {
    const { gender, ...withoutGender } = validBody;

    const errors = await validateBody(withoutGender);

    expect(invalidFields(errors)).toContain('gender');
  });

  it('should accept the optional userName being omitted', async () => {
    const { userName, ...withoutUserName } = validBody;

    const errors = await validateBody(withoutUserName);

    expect(invalidFields(errors)).not.toContain('userName');
  });
});
