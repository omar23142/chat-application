
import { utilities as nestWinstonModuleUtilities, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';


const logger = winston.createLogger({
  level: process.env.LOGGER_LEVEL || 'info',
  // التنسيق العام الافتراضي للملفات والـ Transports الأساسية (Timestamp + JSON)
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({stack:true}),
    winston.format.json()
  ),
  defaultMeta: { service: 'chat-app' },
  transports: [
    // 1. كتابة كافة الأخطاء (error فما أعلى) إلى ملف error.log بصيغة JSON مع الـ timestamp
    new winston.transports.File({ filename: 'logs/error.lg', level: 'error' }),
    
    // 2. كتابة كافة السجلات إلى ملف combined.log
    new winston.transports.File({ filename: 'logs/combined.lg' }),
  ],
});

// إذا لم نكن في بيئة الإنتاج، نقوم بإضافة طباعة الـ Console مع الألوان والتنسيق البسيط والمقروء
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // إضافة الألوان لمستويات السجلات (Error, Info, Warn...)
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // تنسيق زمني واضح للقراءة البشرية
        winston.format.printf(
          ({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          }
        ),
      ),
    })
  );
}

export default logger;