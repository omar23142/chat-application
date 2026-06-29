/**
 * اختبار Race Condition (نسخة Node.js) — بديل عن k6 الذي لا يدعم Socket.IO
 * -----------------------------------------------------------------------
 * ملاحظة: k6 يدعم WebSocket الخام فقط، لكن Socket.IO يضيف بروتوكول engine.io
 * فوقه (HTTP polling → ترقية لـ WebSocket). لذلك كنا نستخدم socket.io-client هنا.
 *
 * هذا الملف هو نسخة مختصرة. للحصول على الإصدار الكامل بالإحصائيات المفصّلة،
 * استخدم: test/race-condition-test.js
 *
 * التشغيل:
 *   npm i -D socket.io-client
 *   node k6-race-condition-test.js
 */
import { io } from 'socket.io-client';
import fs from 'node:fs';

const TARGET = 'http://localhost:3001';
const PARALLEL = 20;
const TIMEOUT_MS = 8000;

const users = JSON.parse(fs.readFileSync('./k6-users.json', 'utf-8')).slice(0, PARALLEL);

const stats = { connected: 0, assigned: 0, errors: 0 };
const roomCounts = new Map();
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
      const count = (roomCounts.get(rid) || 0) + 1;
      roomCounts.set(rid, count);
      if (count > 5) raceDetected = true;
      done();
    });
    socket.on('connect_error', () => { stats.errors++; done(); });
    socket.on('error', () => { stats.errors++; done(); });
    setTimeout(done, TIMEOUT_MS);
  });
}

console.log(`🔥 Race condition test with ${PARALLEL} concurrent clients on joinGroupRoom...\n`);
await Promise.all(users.map(runOne));

console.log(`متصل: ${stats.connected}, حصل على غرفة: ${stats.assigned}, أخطاء: ${stats.errors}\n`);
for (const [rid, count] of roomCounts) {
  const flag = count > 5 ? '🚨 OVERFLOW (race condition!)' : (count === 5 ? '✅ ممتلئة بشكل صحيح' : '');
  console.log(`  الغرفة ${rid}: ${count} مستخدم  ${flag}`);
}

console.log(raceDetected ? '\n❌ فشل: اكتُشف race condition.' : '\n✅ نجاح: لا race condition.');
process.exit(raceDetected ? 1 : 0);
