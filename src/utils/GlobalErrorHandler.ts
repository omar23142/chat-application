
    import {
      ExceptionFilter,
      Catch,
      ArgumentsHost,
      HttpException,
      HttpStatus,
      Logger,
    } from '@nestjs/common';
    import { Request, Response } from 'express';
    import { QueryFailedError } from 'typeorm';

    @Catch()
    export class GlobalExceptionFilter implements ExceptionFilter {
      private readonly logger = new Logger(GlobalExceptionFilter.name);

      catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Skip if not HTTP (e.g. GraphQL or WebSockets)
        if (!response || typeof response.status !== 'function') return;

        // 1. Only pass the exception — the function returns status, message, and isOperational
        const { statusCode, message, isOperational } = this.normalizeError(exception);

        // 2. Log based on severity
        if (isOperational) {
          this.logger.warn(`[${request.method} ${request.url}] ${JSON.stringify(message)}`);
        } else {
          this.logger.error(`CRITICAL [${request.method} ${request.url}]`, exception?.stack);
        }

        // 3. Environment check
        const isDev = process.env.NODE_ENV === 'development';

        if (isDev) {
          return response.status(statusCode).json({
            success: false,
            statusCode,
            message,
            error: exception,
            stack: exception?.stack,
          });
        }

        // Production response (Clean & Safe)
        return response.status(statusCode).json({
          success: false,
          statusCode,
          message: isOperational ? message : 'Something went wrong, please try again later',
        });
      }

      private normalizeError(err: any): { statusCode: number; message: any; isOperational: boolean } {
        // A. NestJS Built-in HttpExceptions (e.g. BadRequestException, NotFoundException)
        if (err instanceof HttpException) {
          return {
            statusCode: err.getStatus(),
            message: err.getResponse(),
            isOperational: true,
          };
        }

        // B. TypeORM / PostgreSQL Database Errors
        if (err instanceof QueryFailedError) {
          const dbError = err as any;

          switch (dbError.code) {
            case '23505': // Unique constraint violation (duplicate key)
              return {
                statusCode: HttpStatus.CONFLICT,
                message: dbError.detail || 'A record with this value already exists',
                isOperational: true,
              };
            case '23503': // Foreign key violation
              return {
                statusCode: HttpStatus.BAD_REQUEST,
                message: 'Referenced entity does not exist',
                isOperational: true,
              };
            case '22P02': // Invalid data type syntax (e.g. invalid UUID format)
              return {
                statusCode: HttpStatus.BAD_REQUEST,
                message: 'Invalid input syntax or ID format',
                isOperational: true,
              };
            default:
              return {
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Database query failed',
                isOperational: false,
              };
          }
        }

        // C. Any other unhandled/programming error
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          isOperational: false,
        };
      }
    }







// import {
//   ExceptionFilter,
//   Catch,
//   ArgumentsHost,
//   HttpException,
//   HttpStatus,
//   Logger,
// } from '@nestjs/common';
// import { Request, Response } from 'express';

// @Catch() // يمسك بجميع الأخطاء بدون استثناء
// export class GlobalExceptionFilter implements ExceptionFilter {
//   private readonly logger = new Logger(GlobalExceptionFilter.name);

//   catch(exception: unknown, host: ArgumentsHost) {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse<Response>();
//     const request = ctx.getRequest<Request>();

//     // Skip if not HTTP context (GraphQL is handled by GqlGlobalExceptionFilter)
//     if (!request || !response) {
//       return;
//     }

//     let status: number;
//     let message: string | object;
//     let isOperational = false;

//     if (exception instanceof HttpException) {
//       status = exception.getStatus();
//       message = exception.getResponse();
//       isOperational = true;
//     } else {
//       status = HttpStatus.INTERNAL_SERVER_ERROR;
//       message = 'internal server error';
//       isOperational = false;
//     }

//     if (isOperational) {
//       this.logger.warn(
//         `Operational Error [${request.method} ${request.url}]: ${JSON.stringify(message)}`,
//       );
//     } else {
//       this.logger.error(
//         `CRITICAL Non-Operational Error [${request.method} ${request.url}]`,
//         exception instanceof Error ? exception.stack : exception,
//       );
//     }

//     response.status(status).json({
//       success: false,
//       statusCode: status,
//       timestamp: new Date().toISOString(),
//       path: request.url,
//       error: typeof message === 'object' ? message : { message },
//     });
//   }
// }
// dealing with error automatically without human dealing 
//1. إعادة المحاولة التلقائية مع التأخير (Automatic Retry with Exponential Backoff)
//2. نمط قاطع الدائرة (Circuit Breaker Pattern)
//3. تقديم خدمة بديلة / التراجع السلس (Fallback Response / Graceful Degradation)
// 4. التحويل والاستبدال التلقائي للخدمات (Failover Mechanisms)
//5. إعادة التعيين والشفاء الذاتي (Self-Healing & Auto-Remediation)