import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RestrictToGuard } from './RestrictTo.guard';
import { CURENT_USER_KEY } from '../../utils/constants';
import { userType } from '../../utils/enum';

describe('RestrictToGuard', () => {
  let guard: RestrictToGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  /** Build the minimal ExecutionContext the guard reads from. */
  function makeContext(user?: { role: string }) {
    const request: any = {};

    if (user) {
      request[CURENT_USER_KEY] = user;
    }

    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RestrictToGuard({} as any, reflector as any);
  });

  it('should throw ForbiddenException when no roles are declared', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      guard.canActivate(makeContext({ role: userType.ADMIN }))
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when the role list is empty', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    await expect(
      guard.canActivate(makeContext({ role: userType.ADMIN }))
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow a user whose role is in the list', async () => {
    reflector.getAllAndOverride.mockReturnValue([userType.ADMIN]);

    await expect(
      guard.canActivate(makeContext({ role: userType.ADMIN }))
    ).resolves.toBe(true);
  });

  it('should deny a user whose role is not in the list', async () => {
    reflector.getAllAndOverride.mockReturnValue([userType.ADMIN]);

    await expect(
      guard.canActivate(makeContext({ role: userType.NORMAL_USER }))
    ).rejects.toThrow(ForbiddenException);
  });
});
