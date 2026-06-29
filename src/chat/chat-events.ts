/**
 * مرجع موحّد لكل أحداث Socket.IO في مشروع الشات.
 * يستخدمها السيرفر (Gateway + RoomManager)، ويمكن للـ Frontend استيرادها.
 *
 * 🔵 Client → Server  (أحداث يرسلها العميل)
 * 🟢 Server → Client  (أحداث يستقبلها العميل)
 */

export const ClientEvents = {
  /** 🔵 يبدأ المطابقة (speed dating). بدون payload. */
  FIND_MATCH: 'findMatch',
  /** 🔵 ينضم لغرفة جماعة. بدون payload. */
  JOIN_GROUP_ROOM: 'joinGroupRoom',
  /** 🔵 يرسل رسالة. payload: { roomId: number, text: string } */
  NEW_MESSAGE: 'newMessage',
  /** 🔵 يعلّم رسالة كمقروءة (غرف دائمة فقط). payload: { roomId: number, messageId: number } */
  MESSAGE_READ: 'messageRead',
  /** 🔵 مؤشر كتابة. payload: { roomId: number | string } */
  TYPING: 'typing',
  /** 🔵 إيقاف مؤشر الكتابة. payload: { roomId: number | string } */
  STOP_TYPING: 'stopTyping',
  /** 🔵 تقييم الشريك أثناء speed dating. payload: number (1-5) */
  RATING: 'rating',
} as const;

export const ServerEvents = {
  /** 🟢 تم دخول غرفة المطابقة. payload: { roomId: number, isFull: boolean } */
  ENTERED_MATCH: 'enteredMatch',
  /** 🟢 تم تخصيص غرفة لك. payload: { roomId } أو { roomId, partnerId } */
  ROOM_ASSIGNED: 'roomAssigned',
  /** 🟢 مستخدم انضم لغرفتك الجماعية. payload: { roomId, userId, message } */
  USER_JOINED: 'userJoined',
  /** 🟢 مستخدم غادر غرفتك الجماعية. payload: { roomId, userId, message } */
  USER_LEFT: 'userLeft',
  /** 🟢 بداية جولة speed dating. payload: { round, roomId, partnerId } */
  ROUND_STARTED: 'roundStarted',
  /** 🟢 نهاية الجولة. payload: { round } */
  ROUND_ENDED: 'roundEnded',
  /** 🟢 بداية فترة التقييم. payload: { round, timeout: number } */
  RATING_PERIOD_STARTED: 'ratingPeriodStarted',
  /** 🟢 سُجّل تقييمك. payload: { message } */
  RATING_RECORDED: 'ratingRecorded',
  /** 🟢 الطرفان قيّما. payload: { roomId, yourRating, partnerRating } */
  RATING_COMPLETE: 'ratingComplete',
  /** 🟢 خطأ في التقييم. payload: { message } */
  RATING_ERROR: 'ratingError',
  /** 🟢 تم إنشاء غرفة دائمة بعد التطابق. payload: { roomId, partnerId } */
  PERMANENT_ROOM_CREATED: 'permanentRoomCreated',
  /** 🟢 انتهت كل الجولات. payload: { matches } */
  SPEED_DATING_COMPLETE: 'speedDatingComplete',
  /** 🟢 الشريك غادر الغرفة الخاصة. payload: { roomId } */
  PARTNER_LEFT: 'partnerLeft',
  /** 🟢 رسالة جديدة. payload: { id?, roomId, message, senderId, createdAt? } */
  NEW_MESSAGE: 'newMessage',
  /** 🟢 إيصال قراءة. payload: { roomId, messageId, readBy, readAt } */
  READ_RECEIPT: 'readReceipt',
  /** 🟢 مستخدم يكتب. payload: { userId, roomId } */
  USER_TYPING: 'userTyping',
  /** 🟢 مستخدم توقف عن الكتابة. payload: { userId, roomId } */
  USER_STOP_TYPING: 'userStopTyping',
  /** 🟢 حالة مستخدم (online/offline). payload: { userId, isOnline, lastSeen } */
  USER_STATUS: 'userStatus',
} as const;
