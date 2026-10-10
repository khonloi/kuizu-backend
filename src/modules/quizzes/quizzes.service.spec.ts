import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { QuizzesService } from './quizzes.service';
import { QuizRepository, QuestionRepository } from './repositories';

describe('QuizzesService', () => {
  let service: QuizzesService;
  let mockQuizRepository: any;
  let mockQuestionRepository: any;

  beforeEach(() => {
    mockQuizRepository = {
      create: vi.fn().mockImplementation((dto) => ({
        _id: new Types.ObjectId(),
        save: vi.fn().mockResolvedValue(true),
        ...dto,
      })),
      findWithDetails: vi.fn(),
      findPaginatedWithDetails: vi.fn(),
      findByIdWithDetails: vi.fn(),
      findByIdAndDelete: vi.fn(),
      incrementPlayCount: vi.fn(),
    };

    mockQuestionRepository = {
      create: vi.fn().mockImplementation((dto) => ({
        _id: new Types.ObjectId(),
        ...dto,
      })),
    };

    service = new QuizzesService(
      mockQuizRepository as unknown as QuizRepository,
      mockQuestionRepository as unknown as QuestionRepository,
    );
  });

  describe('create', () => {
    it('should throw BadRequestException if an invalid question ID is provided', async () => {
      const authorId = new Types.ObjectId().toString();
      await expect(
        service.create(authorId, {
          title: 'Quiz 1',
          questionIds: ['not-a-valid-id'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a quiz with existing questionIds and return populated quiz', async () => {
      const authorId = new Types.ObjectId().toString();
      const questionId = new Types.ObjectId().toString();

      const mockPopulatedQuiz = {
        _id: new Types.ObjectId(),
        title: 'Quiz 1',
        questions: [{ _id: questionId, questionText: 'Q1' }],
      };

      mockQuizRepository.findByIdWithDetails.mockResolvedValue(
        mockPopulatedQuiz,
      );

      const res = await service.create(authorId, {
        title: 'Quiz 1',
        questionIds: [questionId],
      });

      expect(res).toEqual(mockPopulatedQuiz);
      expect(mockQuizRepository.create).toHaveBeenCalled();
    });

    it('should create inline questions if provided in questions array', async () => {
      const authorId = new Types.ObjectId().toString();
      const mockPopulatedQuiz = {
        _id: new Types.ObjectId(),
        title: 'Quiz with inline',
        questions: [{ questionText: 'Inline Q' }],
      };

      mockQuizRepository.findByIdWithDetails.mockResolvedValue(
        mockPopulatedQuiz,
      );

      const res = await service.create(authorId, {
        title: 'Quiz with inline',
        questions: [
          {
            questionText: 'Inline Q',
            choices: [{ text: 'Yes', isCorrect: true }],
          } as any,
        ],
      });

      expect(res).toEqual(mockPopulatedQuiz);
      expect(mockQuestionRepository.create).toHaveBeenCalled();
    });
  });

  describe('findAll & findAllAdmin', () => {
    it('should filter public quizzes for findAll(false)', async () => {
      mockQuizRepository.findWithDetails.mockResolvedValue([
        { title: 'Public Quiz' },
      ]);

      const res = await service.findAll(false);
      expect(mockQuizRepository.findWithDetails).toHaveBeenCalledWith({
        isPublic: true,
      });
      expect(res).toEqual([{ title: 'Public Quiz' }]);
    });

    it('should filter by author when authorId is provided', async () => {
      const authorId = new Types.ObjectId().toString();
      mockQuizRepository.findWithDetails.mockResolvedValue([
        { title: 'My Quiz' },
      ]);

      const res = await service.findAll(true, authorId);
      expect(mockQuizRepository.findWithDetails).toHaveBeenCalledWith({
        author: new Types.ObjectId(authorId),
      });
      expect(res).toEqual([{ title: 'My Quiz' }]);
    });

    it('should return all quizzes for findAllAdmin', async () => {
      mockQuizRepository.findWithDetails.mockResolvedValue([
        { title: 'Public' },
        { title: 'Private' },
      ]);

      const res = await service.findAllAdmin();
      expect(mockQuizRepository.findWithDetails).toHaveBeenCalledWith({});
      expect(res.length).toBe(2);
    });

    it('should delegate to findPaginatedWithDetails when pagination query is provided to findAll', async () => {
      const mockPaginated = {
        data: [{ title: 'Paginated Q' }],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          nextCursor: null,
        },
      };
      mockQuizRepository.findPaginatedWithDetails.mockResolvedValue(
        mockPaginated,
      );

      const query = {
        page: 1,
        limit: 10,
        search: 'test',
        sortOrder: 'desc' as const,
      };
      const res = await service.findAll(false, undefined, query);

      expect(mockQuizRepository.findPaginatedWithDetails).toHaveBeenCalledWith(
        { isPublic: true },
        query,
      );
      expect(res).toBe(mockPaginated);
    });

    it('should delegate to findPaginatedWithDetails when pagination query is provided to findAllAdmin', async () => {
      const mockPaginated = {
        data: [{ title: 'Admin Paginated' }],
        meta: {
          total: 1,
          page: 2,
          limit: 5,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: true,
          nextCursor: null,
        },
      };
      mockQuizRepository.findPaginatedWithDetails.mockResolvedValue(
        mockPaginated,
      );

      const query = { page: 2, limit: 5, sortOrder: 'desc' as const };
      const res = await service.findAllAdmin(query);

      expect(mockQuizRepository.findPaginatedWithDetails).toHaveBeenCalledWith(
        {},
        query,
      );
      expect(res).toBe(mockPaginated);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException on invalid ObjectId', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if quiz is not found', async () => {
      const validId = new Types.ObjectId().toString();
      mockQuizRepository.findByIdWithDetails.mockResolvedValue(null);

      await expect(service.findOne(validId)).rejects.toThrow(NotFoundException);
    });

    it('should return quiz if found', async () => {
      const validId = new Types.ObjectId().toString();
      const mockQuiz = { _id: validId, title: 'Found Quiz' };
      mockQuizRepository.findByIdWithDetails.mockResolvedValue(mockQuiz);

      const res = await service.findOne(validId);
      expect(res).toEqual(mockQuiz);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException if user is not author and not admin', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();
      const otherUser = new Types.ObjectId().toString();

      const mockQuiz = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
      };

      mockQuizRepository.findByIdWithDetails.mockResolvedValue(mockQuiz);

      await expect(
        service.update(id, otherUser, { title: 'Updated' }, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow author to update quiz', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();

      const mockQuiz = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
        title: 'Original Title',
        save: vi.fn().mockResolvedValue(true),
      };

      mockQuizRepository.findByIdWithDetails.mockResolvedValue(mockQuiz);

      const res = await service.update(
        id,
        authorId,
        { title: 'Updated Title' },
        false,
      );
      expect(res.title).toBe('Updated Title');
      expect(mockQuiz.title).toBe('Updated Title');
      expect(mockQuiz.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw ForbiddenException if user is not author and not admin', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();
      const otherUser = new Types.ObjectId().toString();

      const mockQuiz = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
      };

      mockQuizRepository.findByIdWithDetails.mockResolvedValue(mockQuiz);

      await expect(service.delete(id, otherUser, false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete quiz if author matches or if admin', async () => {
      const id = new Types.ObjectId().toString();
      const authorId = new Types.ObjectId().toString();

      const mockQuiz = {
        _id: id,
        author: { _id: new Types.ObjectId(authorId) },
      };

      mockQuizRepository.findByIdWithDetails.mockResolvedValue(mockQuiz);
      mockQuizRepository.findByIdAndDelete.mockResolvedValue({ _id: id });

      const res = await service.delete(id, authorId, false);
      expect(res).toEqual({ success: true });
      expect(mockQuizRepository.findByIdAndDelete).toHaveBeenCalledWith(id);
    });
  });

  describe('incrementPlayCount', () => {
    it('should call incrementPlayCount on repository', async () => {
      const id = new Types.ObjectId().toString();
      await service.incrementPlayCount(id);
      expect(mockQuizRepository.incrementPlayCount).toHaveBeenCalledWith(id);
    });
  });
});
