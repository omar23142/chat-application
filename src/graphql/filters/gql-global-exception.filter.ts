 import {
      Catch,
      ArgumentsHost,
      HttpException,
      HttpStatus,
      Logger,
    } from '@nestjs/common';
    import { GqlExecutionContext } from '@nestjs/graphql';
    import { GraphQLError } from 'graphql';
    import { QueryFailedError } from 'typeorm';

    @Catch()
    export class GqlGlobalExceptionFilter {
      private readonly logger = new Logger(GqlGlobalExceptionFilter.name);

      catch(exception: any, host: ArgumentsHost) {
        const gqlContext = GqlExecutionContext.create(host as any);
        const info = gqlContext.getInfo();
        const fieldName = info?.fieldName ?? 'unknown';

        // 1. Normalize the error (identical logic to REST filter)
        const { statusCode, message, isOperational } = this.normalizeError(exception);

        // 2. Internal Logging
        if (isOperational) {
          this.logger.warn(
            `GraphQL Operational Error [${fieldName}]: ${JSON.stringify(message)}`,
          );
        } else {
          this.logger.error(
            `GraphQL CRITICAL Non-Operational Error [${fieldName}]`,
            exception?.stack ?? exception,
          );
        }

        const isDev = process.env.NODE_ENV === 'development';
        const errorCode = this.getErrorCode(statusCode);

        // 3. Format message: in production, hide non-operational messages
        let clientMessage: string;
        if (isDev || isOperational) {
          clientMessage =
            typeof message === 'object'
              ? (message as any).message || JSON.stringify(message)
              : message;
        } else {
          clientMessage = 'Something went wrong, please try again later';
        }

        // 4. Throw standard GraphQLError with extensions
        throw new GraphQLError(clientMessage, {
          extensions: {
            code: errorCode,
            statusCode,
            timestamp: new Date().toISOString(),
            path: fieldName,
            // In development, include stack trace and raw error for debugging in Playground/Apollo
            ...(isDev && exception?.stack ? { stack: exception.stack } : {}),
            ...(isDev ? { originalError: exception } : {}),
          },
        });
      }

      private normalizeError(err: any): {
        statusCode: number;
        message: any;
        isOperational: boolean;
      } {
        // A. NestJS Built-in HttpExceptions (e.g. NotFoundException, BadRequestException)
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

        // C. Already a formatted GraphQLError
        if (err instanceof GraphQLError) {
          return {
            statusCode: (err.extensions?.statusCode as number) || HttpStatus.INTERNAL_SERVER_ERROR,
            message: err.message,
            isOperational: true,
          };
        }

        // D. Unknown / Programming Error
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          isOperational: false,
        };
      }

      private getErrorCode(status: number): string {
        const codeMap: Record<number, string> = {
          [HttpStatus.BAD_REQUEST]: 'BAD_USER_INPUT',
          [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
          [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
          [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
          [HttpStatus.CONFLICT]: 'CONFLICT',
          [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
          [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
        };
        return codeMap[status] ?? 'INTERNAL_SERVER_ERROR';
      }
    }