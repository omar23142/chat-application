import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // يمسك بجميع الأخطاء بدون استثناء
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | object;
    let isOperational = false;

    // 1. التمييز بين الأخطاء التشغيلية وغير التشغيلية
    if (exception instanceof HttpException) {
      // أخطاء تشغيلية معروفة (Operational Errors)
      status = exception.getStatus();
      message = exception.getResponse();
      isOperational = true;
    } else {
      // أخطاء غير تشغيلية (Non-Operational / Bugs)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'internal server error';
      isOperational = false;
    }

    // 2. التعامل المخصص بناءً على نوع الخطأ
    if (isOperational) {
      // تسجيل خفيف للخطأ التشغيلي لأن السلوك متوقع
      this.logger.warn(
        `Operational Error [${request.method} ${request.url}]: ${JSON.stringify(message)}`,
      );
    } else {
      // تسجيل عالي الأهمية (Critical Log) للأخطاء البرمجية المباغتة مع الـ Stack Trace
      this.logger.error(
        `CRITICAL Non-Operational Error [${request.method} ${request.url}]`,
        exception instanceof Error ? exception.stack : exception,
      );

      // 💡 هنا يمكنك إرسال التنبيه فوراً لأدوات المراقبة مثل Sentry أو Datadog
      // Sentry.captureException(exception);
    }

    // 3. إرجاع رد آمن وموحد للعميل دون كشف تفاصيل الكود الحساسة في الأخطاء غير التشغيلية
    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: typeof message === 'object' ? message : { message },
    });
  }
}
// dealing with error automatically without human dealing 
//1. إعادة المحاولة التلقائية مع التأخير (Automatic Retry with Exponential Backoff)
//2. نمط قاطع الدائرة (Circuit Breaker Pattern)
//3. تقديم خدمة بديلة / التراجع السلس (Fallback Response / Graceful Degradation)
// 4. التحويل والاستبدال التلقائي للخدمات (Failover Mechanisms)
//5. إعادة التعيين والشفاء الذاتي (Self-Healing & Auto-Remediation)