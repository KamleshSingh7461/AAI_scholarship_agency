import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { APP_CONFIG } from './tokens';
import type { BaseConfig } from './config';

/** Uniform error body: { statusCode, error, message, code?, details?, requestId }. Internals never leak in production. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(@Inject(APP_CONFIG) private readonly config: BaseConfig) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const requestId = req?.id ?? req?.headers?.['x-request-id'];

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { message: 'Internal server error' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { message: r } : { ...(r as object) };
    } else if (isPrismaKnown(exception)) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { message: 'A record with these details already exists', code: 'DUPLICATE', details: exception.meta?.target };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { message: 'Record not found', code: 'NOT_FOUND' };
      } else if (exception.code === 'P2034') {
        status = HttpStatus.CONFLICT;
        body = { message: 'Concurrent update, please retry', code: 'WRITE_CONFLICT' };
      }
    }

    if (status >= 500) {
      this.logger.error({ err: exception, requestId }, (exception as Error)?.message ?? 'Unhandled error');
      if (!this.config.isProd && !(exception instanceof HttpException)) body.debug = (exception as Error)?.message;
    }

    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      ...body,
      requestId,
    });
  }
}

function isPrismaKnown(e: unknown): e is { code: string; meta?: { target?: unknown } } {
  return !!e && typeof e === 'object' && 'code' in e && typeof (e as any).code === 'string' && /^P\d{4}$/.test((e as any).code);
}
