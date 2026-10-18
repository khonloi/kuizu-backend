import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HttpException,
  HttpStatus,
  BadRequestException,
  ArgumentsHost,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/test-route',
      method: 'GET',
      headers: { 'x-request-id': 'req-123' },
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    mockConfigService = {
      get: vi.fn().mockReturnValue('development'),
    };

    filter = new AllExceptionsFilter(mockConfigService as ConfigService);
  });

  it('should format HttpException with object response properly', () => {
    const exception = new BadRequestException({
      message: 'Invalid input',
      errors: [{ field: 'title', message: 'Title is required' }],
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        path: '/test-route',
        requestId: 'req-123',
        message: 'Invalid input',
        errors: [{ field: 'title', message: 'Title is required' }],
      }),
    );
  });

  it('should format HttpException with string response', () => {
    const exception = new HttpException(
      'Forbidden access',
      HttpStatus.FORBIDDEN,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden access',
      }),
    );
  });

  it('should convert Mongoose CastError to BAD_REQUEST (400)', () => {
    const castError = {
      name: 'CastError',
      path: '_id',
      value: 'not-a-valid-objectid',
    };

    filter.catch(castError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Invalid ID format for path '_id': not-a-valid-objectid",
      }),
    );
  });

  it('should convert Mongoose duplicate key error (code 11000) to CONFLICT (409)', () => {
    const duplicateError = {
      code: 11000,
    };

    filter.catch(duplicateError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        message: 'A resource with this unique identifier already exists',
      }),
    );
  });

  it('should expose error message in non-production environment', () => {
    (mockConfigService.get as any).mockReturnValue('development');
    const genericError = new Error('Database connection failed');

    filter.catch(genericError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Database connection failed',
      }),
    );
  });

  it('should sanitize error message in production environment', () => {
    (mockConfigService.get as any).mockReturnValue('production');
    const genericError = new Error('Sensitive DB credentials leaked');

    filter.catch(genericError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
  });

  it('should safely return if response.status is not a function (non-HTTP context)', () => {
    const invalidHost = {
      switchToHttp: () => ({
        getResponse: () => null,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    expect(() =>
      filter.catch(new Error('Ws error'), invalidHost),
    ).not.toThrow();
  });
});
