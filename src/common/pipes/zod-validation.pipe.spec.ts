import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('should return value directly when schema is not provided', () => {
    const pipe = new ZodValidationPipe();
    const result = pipe.transform({ test: 123 }, { type: 'body' });
    expect(result).toEqual({ test: 123 });
  });

  it('should return parsed data when validation succeeds', () => {
    const schema = z.object({
      name: z.string().trim(),
      age: z.number().min(1),
    });
    const pipe = new ZodValidationPipe(schema);

    const input = { name: '  Alice  ', age: 25 };
    const result = pipe.transform(input, { type: 'body' });

    expect(result).toEqual({ name: 'Alice', age: 25 });
  });

  it('should throw BadRequestException with formatted errors when validation fails', () => {
    const schema = z.object({
      email: z.string().email(),
    });
    const pipe = new ZodValidationPipe(schema);

    expect(() =>
      pipe.transform({ email: 'invalid-email' }, { type: 'body' }),
    ).toThrow(BadRequestException);

    try {
      pipe.transform({ email: 'invalid-email' }, { type: 'body' });
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        statusCode: 400,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
          }),
        ]),
      });
    }
  });
});
