/**
 * اختبار Race Condition باستخدام socket.io-client
 * ----------------------------------------------------
 * يُحمّل المستخدمين من k6-users.json، يُوصل N عميل بالتزامن،
 * يُرسلون 'joinGroupRoom' في نفس اللحظة، ثم يتحقق من عدم overflow الغرف.
 *
 * القاعدة: كل غرفة جماعة RoomData تقبل 5 لكل جنس كحد أقصى.
 * لو ظهرت غرفة بها 6+ مستخدمين = 🚨 RACE CONDITION (الـ mutex معطّل).
 * لو 5 بالضبط = ✅ الـ mutex يعمل.
 *
 * التشغيل:
 *   1) شغّل السيرفر:  npm run dev
 *   2) شغّل الاختبار:  node test/race-condition-test.js
 */
import { io } from 'socket.io-client';
import fs from 'node:fs';

const TARGET = process.env.TARGET || 'http://localhost:3001';
const PARALLEL = parseInt(process.env.PARALLEL || '20', 10);
const TIMEOUT_MS = 8000;

// نقرأ المستخدمين المُولّدين مسبقاً
const users = JSON.parse(fs.readFileSync('./k6-users.json', 'utf-8'));
const batch = users.slice(0, Math.min(PARALLEL, users.length));

// إحصائيات النتائج
let connected = 0;
let assigned = 0;
let errors = 0;
const roomCounts = new Map(); // roomId -> عدد المنضمّين

function runOne(user) {
  return new Promise((resolve) => {
    const socket = io(TARGET, {
      auth: { token: user.token },
      transports: ['websocket'],
      timeout: TIMEOUT_MS,
    });
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch (_) {}
      resolve(ok);
    };

    socket.on('connect', () => {
      connected++;
      // نُحاول دخول غرفة جماعة في نفس اللحظة لكل العملاء
      socket.emit('joinGroupRoom');
    });

    // نراقب إشعار تخصيص الغرفة
    socket.on('roomAssigned', (data) => {
      assigned++;
      const rid = typeof data === 'object' ? data.roomId : data;
      roomCounts.set(rid, (roomCounts.get(rid) || 0) + 1);
      finish(true);
    });

    socket.on('connect_error', () => { errors++; finish(false); });
    socket.on('error', () => { errors++; finish(false); });
    setTimeout(() => { if (!settled) { errors++; finish(false); } }, TIMEOUT_MS);
  });
}

console.log(`🔥 Testing race condition with ${batch.length} concurrent clients...`);
console.log(`   Target: ${TARGET}`);
console.log(`   Event:  joinGroupRoom\n`);

await Promise.all(batch.map(runOne));

console.log('\n========== النتائج ==========');
console.log(`متصل:        ${connected} / ${batch.length}`);
console.log(`حصل على غرفة: ${assigned}`);
console.log(`أخطاء/انتهت المهلة: ${errors}`);

console.log('\n========== توزيع الغرف ==========');
let raceDetected = false;
for (const [rid, count] of roomCounts) {
  const flag = count > 5
    ? '🚨 OVERFLOW - RACE CONDITION! (الـ mutex معطّل)'
    : count === 5
      ? '✅ ممتلئة بشكل صحيح (الـ mutex يعمل)'
      : '';
  if (count > 5) raceDetected = true;
  console.log(`  الغرفة ${rid}: ${count} مستخدم  ${flag}`);
}

console.log('\n========== الخلاصة ==========');
if (raceDetected) {
  console.log('❌ فشل: اكتُشف race condition. غرفة واحدة حصلت على أكثر من 5 مستخدمين.');
  process.exit(1);
} else {
  console.log('✅ نجاح: لم يُكتشف race condition. كل غرفة ضمن الحد المسموح.');
  process.exit(0);
}
