import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (!response || typeof response.status !== 'function') {
      this.logger.error('Unhandled exception in non-HTTP context:', exception);
      return;
    }

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let errors: unknown = undefined;

    if (exception && typeof exception === 'object') {
      const err = exception as Record<string, unknown>;
      if (err.name === 'CastError') {
        status = HttpStatus.BAD_REQUEST;
        message = `Invalid ID format for path '${(err.path as string) || 'id'}': ${String(err.value)}`;
      } else if (err.code === 11000) {
        status = HttpStatus.CONFLICT;
        message = 'A resource with this unique identifier already exists';
      }
    }

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const respObj = exceptionResponse as Record<string, unknown>;
      message = (respObj.message as string) || message;
      errors = respObj.errors;
    } else if (
      exception instanceof Error &&
      status === HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      const isProduction = process.env.NODE_ENV === 'production';
      message = isProduction ? 'Internal server error' : exception.message;
      if (isProduction) {
        errors = undefined;
      }
    }

    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request as unknown as { id?: string }).id;

    if (status >= 500) {
      this.logger.error(
        `HTTP ${status} [${request.method}] ${request.url} [reqId: ${requestId || 'N/A'}]: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId ? { requestId } : {}),
      message,
      ...(errors ? { errors } : {}),
    });
  }
}
