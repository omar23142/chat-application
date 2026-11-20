import { RoomManger } from './room-manager.service';
import { ServerEvents } from './chat-events';

/**
 * RoomManger has no constructor dependencies, so we can test it directly.
 * We only need a "fake socket" with the fields the manager touches.
 */
function makeSocket(userId: number) {
  const toEmit = jest.fn();

  return {
    data: { user: { id: userId } },
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn(() => ({ emit: toEmit })),

    // Helper used only by the tests to assert what `socket.to(...).emit(...)` sent.
    __toEmit: toEmit,
  } as any;
}

function makeRoom(id: number, maleCount: number, femaleCount: number) {
  return {
    id,
    male: new Set(
      Array.from({ length: maleCount }, (_, i) => makeSocket(i + 1))
    ),
    female: new Set(
      Array.from({ length: femaleCount }, (_, i) => makeSocket(i + 100))
    ),
    full: maleCount >= 5 && femaleCount >= 5,
  };
}

describe('RoomManger', () => {
  let manager: RoomManger;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new RoomManger();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('AssignRoom', () => {
    it('should create a new room when none exists', async () => {
      const alice = makeSocket(1);

      const room = await manager.AssignRoom('1', alice, 'female');

      expect(room.id).toBe(1);
      expect(room.female?.has(alice)).toBe(true);
      expect(room.male).toBeNull();
    });

    it('should add a client to an existing free room', async () => {
      const alice = makeSocket(1);
      const bob = makeSocket(2);

      const firstRoom = await manager.AssignRoom('1', alice, 'female');
      const secondRoom = await manager.AssignRoom('2', bob, 'male');

      expect(secondRoom.id).toBe(firstRoom.id);
      expect(secondRoom.male?.has(bob)).toBe(true);
    });

    it('should mark the room as full once it has 5 males and 5 females', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.AssignRoom(String(i), makeSocket(i + 1), 'female');
      }

      let lastRoom: any;
      for (let i = 0; i < 5; i++) {
        lastRoom = await manager.AssignRoom(
          String(i + 10),
          makeSocket(i + 10),
          'male'
        );
      }

      expect(lastRoom.full).toBe(true);
    });

    it('should remove the room when its last member leaves', async () => {
      const alice = makeSocket(1);
      const room = await manager.AssignRoom('1', alice, 'female');

      manager.removeClientFromGroupRoom(alice, 'female');

      expect(manager.getGroupRoomById(room.id)).toBeUndefined();
      expect(alice.__toEmit).toHaveBeenCalledWith(
        ServerEvents.USER_LEFT,
        expect.objectContaining({ userId: 1 })
      );
    });

    it('should keep the room when another member is still inside', async () => {
      const alice = makeSocket(1);
      const bob = makeSocket(2);
      const room = await manager.AssignRoom('1', alice, 'female');
      await manager.AssignRoom('2', bob, 'female');

      manager.removeClientFromGroupRoom(alice, 'female');

      expect(manager.getGroupRoomById(room.id)).toBeDefined();
    });
  });

  describe('FindmatchRoom', () => {
    it('should create a new match room and report it is not full', async () => {
      const result = await manager.FindmatchRoom(makeSocket(1), 'male');

      expect(result?.room.id).toBe(1);
      expect(result?.justBecameFull).toBe(false);
    });

    it('should report justBecameFull on the last slot', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.FindmatchRoom(makeSocket(i + 1), 'female');
      }

      let result: any;
      for (let i = 0; i < 5; i++) {
        result = await manager.FindmatchRoom(makeSocket(i + 10), 'male');
      }

      expect(result?.justBecameFull).toBe(true);
    });
  });

  describe('findFreeGroupRoom / findFreeMatchRoom', () => {
    it('should return null when the room list is empty', () => {
      expect(manager.findFreeGroupRoom([], 'male')).toBeNull();
      expect(manager.findFreeMatchRoom([], 'female')).toBeNull();
    });

    it('should return null when a room is already full', () => {
      const fullRoom = makeRoom(1, 5, 5);

      expect(manager.findFreeGroupRoom([fullRoom], 'male')).toBeNull();
      expect(manager.findFreeMatchRoom([fullRoom], 'female')).toBeNull();
    });

    it('should return a room that still has space', () => {
      const freeRoom = makeRoom(7, 2, 1);

      expect(manager.findFreeGroupRoom([freeRoom], 'male')).toBe(freeRoom);
      expect(manager.findFreeMatchRoom([freeRoom], 'female')).toBe(freeRoom);
    });
  });

  describe('permanent rooms', () => {
    it('should remember a registered permanent room', () => {
      expect(manager.isPermanentRoom(10)).toBe(false);

      manager.registerPermanentRoom(10);

      expect(manager.isPermanentRoom(10)).toBe(true);
    });
  });

  describe('pending matches', () => {
    it('should store a pair only once even if the order is reversed', () => {
      manager.addPendingMatch(1, 2, 1);
      manager.addPendingMatch(2, 1, 2);

      expect(manager.getAllPendingMatches()).toEqual([
        { userId1: 2, userId2: 1 },
      ]);
    });

    it('should clear every pending match', () => {
      manager.addPendingMatch(1, 2, 1);

      manager.clearPendingMatches();

      expect(manager.getAllPendingMatches()).toEqual([]);
    });
  });

  describe('handleRating', () => {
    it('should reject a rating outside 1..5', () => {
      const client = makeSocket(1);

      manager.handleRating(client, 6);

      expect(client.emit).toHaveBeenCalledWith(ServerEvents.RATING_ERROR, {
        message: 'Rating must be between 1 and 5',
      });
    });

    it('should reject a client that is not in a private room', () => {
      const client = makeSocket(1);

      manager.handleRating(client, 3);

      expect(client.emit).toHaveBeenCalledWith(ServerEvents.RATING_ERROR, {
        message: 'You are not in a private room',
      });
    });

    it('should record the first rating and wait for the partner', () => {
      const alice = makeSocket(1);
      const bob = makeSocket(2);
      manager.CreatePrivateChatRoom(alice, bob);

      manager.handleRating(alice, 5);

      expect(alice.emit).toHaveBeenCalledWith(ServerEvents.RATING_RECORDED, {
        message:
          'Your rating has been recorded. Waiting for partner to rate...',
      });
    });

    it('should complete the rating when both partners rated', () => {
      const alice = makeSocket(1);
      const bob = makeSocket(2);
      const roomName = manager.CreatePrivateChatRoom(alice, bob);

      manager.handleRating(alice, 5);
      manager.handleRating(bob, 5);

      expect(alice.emit).toHaveBeenCalledWith(ServerEvents.RATING_COMPLETE, {
        roomId: roomName,
        yourRating: 5,
        partnerRating: 5,
      });
    });
  });

  describe('private rooms', () => {
    it('should notify the partner and delete the room when a client leaves', () => {
      const alice = makeSocket(1);
      const bob = makeSocket(2);
      const roomName = manager.CreatePrivateChatRoom(alice, bob);

      manager.removeClientFromPrivateRoom(alice);

      expect(alice.__toEmit).toHaveBeenCalledWith(ServerEvents.PARTNER_LEFT, {
        roomId: roomName,
      });
      expect(alice.leave).toHaveBeenCalledWith(roomName);
      expect(manager.privateRoom.has(roomName)).toBe(false);
    });

    it('should destroy every given private room', () => {
      const alice = makeSocket(1);
      const bob = makeSocket(2);
      const roomName = manager.CreatePrivateChatRoom(alice, bob);

      manager.DestroyPrivateRoom([roomName]);

      expect(manager.privateRoom.has(roomName)).toBe(false);
    });
  });
});
