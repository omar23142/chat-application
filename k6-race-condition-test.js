/**
 * Race Condition Test (Node.js version) — alternative to k6 which lacks Socket.IO support
 * -----------------------------------------------------------------------
 * Note: k6 only supports raw WebSocket, but Socket.IO adds the engine.io protocol
 * on top of it (HTTP polling -> upgrade to WebSocket). That's why we use socket.io-client here.
 *
 * This is a simplified version. For the full version with detailed stats,
 * use: test/race-condition-test.js
 *
 * Usage:
 *   npm i -D socket.io-client
 *   node k6-race-condition-test.js
 */
import { io } from 'socket.io-client';
import fs from 'node:fs';

const TARGET = 'http://localhost:3001';
const PARALLEL = 2000;
const TIMEOUT_MS = 10000;

const users = JSON.parse(fs.readFileSync('./k6-users.json', 'utf-8')).slice(0, PARALLEL);

const stats = { connected: 0, assigned: 0, errors: 0 };
// const roomCounts = new Map();
let raceDetected = false;

function runOne(user) {
  return new Promise((resolve) => {
    const socket = io(TARGET, {
      auth: { token: user.token },
      transports: ['websocket'],
      timeout: TIMEOUT_MS,
    });
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch (_) {}
      resolve();
    };

    socket.on('connect', () => {
      stats.connected++;
      socket.emit('joinGroupRoom');
    });
    socket.on('roomAssigned', (data) => {
      stats.assigned++;
      const rid = typeof data === 'object' ? data.roomId : data;
      // const count = (roomCounts.get(rid) || 0) + 1;
      console.log('room_assigned from testtttttttttttttttt', data);
      // roomCounts.set(rid, count);
      if (data.femal > 5 || data.male > 5)  raceDetected = true;
      done();
    });
    socket.on('connect_error', () => { stats.errors++; done(); });
    socket.on('error', () => { stats.errors++; done(); });
    setTimeout(done, TIMEOUT_MS);
  });
}

console.log(`🔥 Race condition test with ${PARALLEL} concurrent clients on joinGroupRoom...\n`);
await Promise.all(users.map(runOne));  // run the 2000 user in the same time 

console.log(`Connected: ${stats.connected}, Room Assigned: ${stats.assigned}, Errors: ${stats.errors}\n`);
// for (const [rid, count] of roomCounts) {
//   const flag = count > 5 ? '🚨 OVERFLOW (race condition!)' : (count === 5 ? '✅ Properly filled' : '');
//   console.log(`  Room ${rid}: ${count} users  ${flag}`);
// }

console.log(raceDetected ? '\n❌ Failed: Race condition detected.' : '\n✅ Success: No race condition.');
process.exit(raceDetected ? 1 : 0);
