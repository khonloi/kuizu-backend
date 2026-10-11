import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from './parse-object-id.pipe';

describe('ParseObjectIdPipe', () => {
  const pipe = new ParseObjectIdPipe();

  it('should return valid ObjectId string unchanged', () => {
    const validId = new Types.ObjectId().toString();
    expect(pipe.transform(validId)).toBe(validId);
  });

  it('should throw BadRequestException for invalid string', () => {
    expect(() => pipe.transform('invalid-id-123')).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for empty string', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });
});
