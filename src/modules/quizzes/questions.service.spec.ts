import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { QuestionsService } from './questions.service';

describe('QuestionsService', () => {
  let service: QuestionsService;
  let mockQuestionModel: any;

  beforeEach(() => {
    mockQuestionModel = vi.fn().mockImplementation(function (
      this: any,
      dto: any,
    ) {
      Object.assign(this, dto);
      this.save = vi
        .fn()
        .mockResolvedValue({ _id: new Types.ObjectId(), ...dto });
    });
    mockQuestionModel.find = vi.fn();
    mockQuestionModel.findById = vi.fn();
    mockQuestionModel.findByIdAndDelete = vi.fn();

    service = new QuestionsService(mockQuestionModel);
  });

  describe('create', () => {
    it('should create and return a question with author ObjectId', async () => {
      const authorId = new Types.ObjectId().toString();
      const dto = {
        questionText: 'What is TypeScript?',
        type: 'multiple-choice' as const,
        timeLimit: 20,
        points: 1000,
        mediaUrl: '',
        choices: [
          { text: 'A superset of JS', isCorrect: true, color: 'blue' as const },
          { text: 'A database', isCorrect: false, color: 'red' as const },
        ],
        tags: ['programming'],
        difficulty: 'medium' as const,
      };

      const res = await service.create(authorId, dto as any);
      expect(res.questionText).toBe(dto.questionText);
      expect(res.author.toString()).toBe(authorId);
    });
  });

  describe('findAll', () => {
    it('should query with filters and populate author', async () => {
      const authorId = new Types.ObjectId().toString();
      const mockQuestions = [{ questionText: 'Q1' }];
      const queryMock = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockQuestions),
      };
      mockQuestionModel.find.mockReturnValue(queryMock);

      const res = await service.findAll({
        authorId,
        tag: 'js',
        search: 'script',
        difficulty: 'easy',
      });

      expect(mockQuestionModel.find).toHaveBeenCalledWith({
        author: new Types.ObjectId(authorId),
        tags: 'js',
        difficulty: 'easy',
        questionText: { $regex: 'script', $options: 'i' },
      });
      expect(queryMock.populate).toHaveBeenCalledWith(
        'author',
        'username avatarUrl',
      );
      expect(res).toEqual(mockQuestions);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException on invalid ObjectId', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if question does not exist', async () => {
      const validId = new Types.ObjectId().toString();
      mockQuestionModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.findOne(validId)).rejects.toThrow(NotFoundException);
    });

    it('should return question if found', async () => {
      const validId = new Types.ObjectId().toString();
      const mockQuestion = { _id: validId, questionText: 'Q1' };
      mockQuestionModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockQuestion),
      });

      const res = await service.findOne(validId);
      expect(res).toEqual(mockQuestion);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException if user is not author and not admin', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();
      const otherUserId = new Types.ObjectId().toString();
      const mockQuestion = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
        save: vi.fn(),
      };

      mockQuestionModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockQuestion),
      });

      await expect(
        service.update(id, otherUserId, { questionText: 'Updated' }, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow author to update', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();
      const mockQuestion = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
        questionText: 'Old',
        save: vi.fn().mockResolvedValue({ _id: id, questionText: 'New' }),
      };

      mockQuestionModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockQuestion),
      });

      const res = await service.update(
        id,
        authorId,
        { questionText: 'New' },
        false,
      );
      expect(res.questionText).toBe('New');
      expect(mockQuestion.save).toHaveBeenCalled();
    });

    it('should allow admin to update any question', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();
      const adminId = new Types.ObjectId().toString();
      const mockQuestion = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
        questionText: 'Old',
        save: vi
          .fn()
          .mockResolvedValue({ _id: id, questionText: 'Admin Update' }),
      };

      mockQuestionModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockQuestion),
      });

      const res = await service.update(
        id,
        adminId,
        { questionText: 'Admin Update' },
        true,
      );
      expect(res.questionText).toBe('Admin Update');
      expect(mockQuestion.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw ForbiddenException if user is not author and not admin', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();
      const otherUserId = new Types.ObjectId().toString();
      const mockQuestion = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
      };

      mockQuestionModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockQuestion),
      });

      await expect(service.delete(id, otherUserId, false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete if author matches', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();
      const mockQuestion = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
      };

      mockQuestionModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockQuestion),
      });
      mockQuestionModel.findByIdAndDelete.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: id }),
      });

      const res = await service.delete(id, authorId, false);
      expect(res).toEqual({ success: true });
      expect(mockQuestionModel.findByIdAndDelete).toHaveBeenCalledWith(id);
    });

    it('should allow admin to delete any question', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();
      const adminId = new Types.ObjectId().toString();
      const mockQuestion = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
      };

      mockQuestionModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockQuestion),
      });
      mockQuestionModel.findByIdAndDelete.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: id }),
      });

      const res = await service.delete(id, adminId, true);
      expect(res).toEqual({ success: true });
      expect(mockQuestionModel.findByIdAndDelete).toHaveBeenCalledWith(id);
    });
  });
});
