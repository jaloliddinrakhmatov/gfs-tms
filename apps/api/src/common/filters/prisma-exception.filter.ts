import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Maps well-known Prisma errors to proper HTTP responses instead of 500s. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'A record with this value already exists'],
      P2025: [HttpStatus.NOT_FOUND, 'Record not found'],
      P2003: [HttpStatus.BAD_REQUEST, 'Related record does not exist'],
    };
    const [statusCode, message] = map[exception.code] ?? [
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Database error',
    ];
    res.status(statusCode).json({
      statusCode,
      message,
      error: exception.code,
      ...(exception.code === 'P2002' ? { fields: exception.meta?.target } : {}),
    });
  }
}
