import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { QuizzesService } from './quizzes.service';

describe('QuizzesService', () => {
  let service: QuizzesService;
  let mockQuizModel: any;
  let mockQuestionModel: any;

  beforeEach(() => {
    mockQuizModel = vi.fn().mockImplementation(function (this: any, dto: any) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.save = vi.fn().mockResolvedValue(this);
    });
    mockQuizModel.find = vi.fn();
    mockQuizModel.findById = vi.fn();
    mockQuizModel.findByIdAndUpdate = vi.fn();
    mockQuizModel.findByIdAndDelete = vi.fn();

    mockQuestionModel = vi.fn().mockImplementation(function (
      this: any,
      dto: any,
    ) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.save = vi.fn().mockResolvedValue(this);
    });

    service = new QuizzesService(mockQuizModel, mockQuestionModel);
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

      mockQuizModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockPopulatedQuiz),
          }),
        }),
      });

      const res = await service.create(authorId, {
        title: 'Quiz 1',
        questionIds: [questionId],
      });

      expect(res).toEqual(mockPopulatedQuiz);
    });

    it('should create inline questions if provided in questions array', async () => {
      const authorId = new Types.ObjectId().toString();
      const mockPopulatedQuiz = {
        _id: new Types.ObjectId(),
        title: 'Quiz with inline',
        questions: [{ questionText: 'Inline Q' }],
      };

      mockQuizModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockPopulatedQuiz),
          }),
        }),
      });

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
      expect(mockQuestionModel).toHaveBeenCalled();
    });
  });

  describe('findAll & findAllAdmin', () => {
    it('should filter public quizzes for findAll(false)', async () => {
      const queryMock = {
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              exec: vi.fn().mockResolvedValue([{ title: 'Public Quiz' }]),
            }),
          }),
        }),
      };
      mockQuizModel.find.mockReturnValue(queryMock);

      const res = await service.findAll(false);
      expect(mockQuizModel.find).toHaveBeenCalledWith({ isPublic: true });
      expect(res).toEqual([{ title: 'Public Quiz' }]);
    });

    it('should filter by author when authorId is provided', async () => {
      const authorId = new Types.ObjectId().toString();
      const queryMock = {
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              exec: vi.fn().mockResolvedValue([{ title: 'My Quiz' }]),
            }),
          }),
        }),
      };
      mockQuizModel.find.mockReturnValue(queryMock);

      const res = await service.findAll(true, authorId);
      expect(mockQuizModel.find).toHaveBeenCalledWith({
        author: new Types.ObjectId(authorId),
      });
      expect(res).toEqual([{ title: 'My Quiz' }]);
    });

    it('should return all quizzes for findAllAdmin', async () => {
      const queryMock = {
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              exec: vi
                .fn()
                .mockResolvedValue([{ title: 'Public' }, { title: 'Private' }]),
            }),
          }),
        }),
      };
      mockQuizModel.find.mockReturnValue(queryMock);

      const res = await service.findAllAdmin();
      expect(mockQuizModel.find).toHaveBeenCalledWith();
      expect(res.length).toBe(2);
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
      mockQuizModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(service.findOne(validId)).rejects.toThrow(NotFoundException);
    });

    it('should return quiz if found', async () => {
      const validId = new Types.ObjectId().toString();
      const mockQuiz = { _id: validId, title: 'Found Quiz' };
      mockQuizModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockQuiz),
          }),
        }),
      });

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

      mockQuizModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockQuiz),
          }),
        }),
      });

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

      mockQuizModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockQuiz),
          }),
        }),
      });

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

      mockQuizModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockQuiz),
          }),
        }),
      });

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

      mockQuizModel.findById.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockQuiz),
          }),
        }),
      });
      mockQuizModel.findByIdAndDelete.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: id }),
      });

      const res = await service.delete(id, authorId, false);
      expect(res).toEqual({ success: true });
      expect(mockQuizModel.findByIdAndDelete).toHaveBeenCalledWith(id);
    });
  });

  describe('incrementPlayCount', () => {
    it('should call findByIdAndUpdate with increment', async () => {
      const id = new Types.ObjectId().toString();
      await service.incrementPlayCount(id);
      expect(mockQuizModel.findByIdAndUpdate).toHaveBeenCalledWith(id, {
        $inc: { playCount: 1 },
      });
    });
  });
});
