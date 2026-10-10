import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { QuestionsService } from './questions.service';
import { QuestionRepository } from './repositories';

describe('QuestionsService', () => {
  let service: QuestionsService;
  let mockQuestionRepository: any;

  beforeEach(() => {
    mockQuestionRepository = {
      create: vi.fn().mockImplementation((dto) => ({
        _id: new Types.ObjectId(),
        ...dto,
      })),
      findWithDetails: vi.fn(),
      findByIdWithDetails: vi.fn(),
      findByIdAndDelete: vi.fn(),
    };

    service = new QuestionsService(
      mockQuestionRepository as unknown as QuestionRepository,
    );
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
      expect(mockQuestionRepository.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should query with filters and return questions', async () => {
      const authorId = new Types.ObjectId().toString();
      const mockQuestions = [{ questionText: 'Q1' }];
      mockQuestionRepository.findWithDetails.mockResolvedValue(mockQuestions);

      const res = await service.findAll({
        authorId,
        tag: 'js',
        search: 'script',
        difficulty: 'easy',
      });

      expect(mockQuestionRepository.findWithDetails).toHaveBeenCalledWith({
        author: new Types.ObjectId(authorId),
        tags: 'js',
        difficulty: 'easy',
        questionText: { $regex: 'script', $options: 'i' },
      });
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
      mockQuestionRepository.findByIdWithDetails.mockResolvedValue(null);

      await expect(service.findOne(validId)).rejects.toThrow(NotFoundException);
    });

    it('should return question if found', async () => {
      const validId = new Types.ObjectId().toString();
      const mockQuestion = { _id: validId, questionText: 'Q1' };
      mockQuestionRepository.findByIdWithDetails.mockResolvedValue(
        mockQuestion,
      );

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

      mockQuestionRepository.findByIdWithDetails.mockResolvedValue(
        mockQuestion,
      );

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

      mockQuestionRepository.findByIdWithDetails.mockResolvedValue(
        mockQuestion,
      );

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

      mockQuestionRepository.findByIdWithDetails.mockResolvedValue(
        mockQuestion,
      );

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

      mockQuestionRepository.findByIdWithDetails.mockResolvedValue(
        mockQuestion,
      );

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

      mockQuestionRepository.findByIdWithDetails.mockResolvedValue(
        mockQuestion,
      );
      mockQuestionRepository.findByIdAndDelete.mockResolvedValue({ _id: id });

      const res = await service.delete(id, authorId, false);
      expect(res).toEqual({ success: true });
      expect(mockQuestionRepository.findByIdAndDelete).toHaveBeenCalledWith(id);
    });

    it('should allow admin to delete any question', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();
      const adminId = new Types.ObjectId().toString();
      const mockQuestion = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
      };

      mockQuestionRepository.findByIdWithDetails.mockResolvedValue(
        mockQuestion,
      );
      mockQuestionRepository.findByIdAndDelete.mockResolvedValue({ _id: id });

      const res = await service.delete(id, adminId, true);
      expect(res).toEqual({ success: true });
      expect(mockQuestionRepository.findByIdAndDelete).toHaveBeenCalledWith(id);
    });
  });
});
