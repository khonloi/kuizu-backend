import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  isValidObjectId,
  tryToObjectId,
  toObjectId,
  assertObjectId,
  extractIdString,
  areObjectIdsEqual,
} from './object-id.util';

describe('object-id.util', () => {
  const validHex = new Types.ObjectId().toHexString();
  const validObjId = new Types.ObjectId(validHex);

  describe('isValidObjectId', () => {
    it('returns true for a Types.ObjectId instance', () => {
      expect(isValidObjectId(validObjId)).toBe(true);
    });

    it('returns true for a valid 24-char hex string', () => {
      expect(isValidObjectId(validHex)).toBe(true);
    });

    it('returns false for invalid strings and primitives', () => {
      expect(isValidObjectId('invalid-id')).toBe(false);
      expect(isValidObjectId('')).toBe(false);
      expect(isValidObjectId(null)).toBe(false);
      expect(isValidObjectId(undefined)).toBe(false);
      expect(isValidObjectId(12345)).toBe(false);
      expect(isValidObjectId('12345678901234567890123z')).toBe(false);
    });
  });

  describe('tryToObjectId', () => {
    it('returns the same Types.ObjectId if already one', () => {
      expect(tryToObjectId(validObjId)).toBe(validObjId);
    });

    it('converts valid string to Types.ObjectId', () => {
      const res = tryToObjectId(validHex);
      expect(res).toBeInstanceOf(Types.ObjectId);
      expect(res?.toString()).toBe(validHex);
    });

    it('returns null for invalid values', () => {
      expect(tryToObjectId('bad-id')).toBeNull();
      expect(tryToObjectId(undefined)).toBeNull();
    });
  });

  describe('toObjectId & assertObjectId', () => {
    it('returns ObjectId when valid', () => {
      const res = assertObjectId(validHex, 'quiz');
      expect(res.toString()).toBe(validHex);
      const res2 = toObjectId(validHex, 'quiz');
      expect(res2.toString()).toBe(validHex);
    });

    it('throws BadRequestException by default on invalid id', () => {
      expect(() => assertObjectId('bad-id', 'Quiz')).toThrow(
        BadRequestException,
      );
      expect(() => assertObjectId('bad-id', 'Quiz')).toThrow(
        "Invalid Quiz format: 'bad-id'",
      );
    });

    it('uses custom error factory when provided', () => {
      expect(() =>
        assertObjectId('bad-id', 'Quiz', (msg) => new NotFoundException(msg)),
      ).toThrow(NotFoundException);
    });
  });

  describe('extractIdString', () => {
    it('extracts string from various shapes', () => {
      expect(extractIdString(validHex)).toBe(validHex);
      expect(extractIdString(validObjId)).toBe(validHex);
      expect(extractIdString({ _id: validObjId })).toBe(validHex);
      expect(extractIdString({ _id: validHex })).toBe(validHex);
      expect(extractIdString({ id: validHex })).toBe(validHex);
      expect(extractIdString(null)).toBeNull();
      expect(extractIdString(undefined)).toBeNull();
    });
  });

  describe('areObjectIdsEqual', () => {
    it('correctly compares strings and ObjectIds', () => {
      expect(areObjectIdsEqual(validHex, validObjId)).toBe(true);
      expect(areObjectIdsEqual({ _id: validHex }, validObjId)).toBe(true);
      expect(areObjectIdsEqual({ id: validHex }, validHex)).toBe(true);
      expect(areObjectIdsEqual(validHex, new Types.ObjectId())).toBe(false);
      expect(areObjectIdsEqual(null, validHex)).toBe(false);
    });
  });
});
