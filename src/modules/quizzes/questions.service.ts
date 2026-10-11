import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { QuestionDocument, QuizChoice } from './schemas/question.schema';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/question.dto';
import { QuestionRepository } from './repositories';
import { escapeRegex } from '../../common/utils/regex.util';

@Injectable()
export class QuestionsService {
  constructor(private readonly questionRepository: QuestionRepository) {}

  async create(
    authorId: string,
    dto: CreateQuestionDto,
  ): Promise<QuestionDocument> {
    return this.questionRepository.create({
      ...dto,
      author: new Types.ObjectId(authorId),
    });
  }

  private sanitizeQuestion(question: any): any {
    if (!question) return question;
    const qObj =
      typeof question.toObject === 'function'
        ? question.toObject()
        : { ...question };
    if (Array.isArray(qObj.choices)) {
      qObj.choices = qObj.choices.map((c: any) => {
        const { isCorrect: _isCorrect, ...rest } = c;
        return rest;
      });
    }
    return qObj;
  }

  async findAll(
    filterOptions?: {
      authorId?: string;
      tag?: string;
      search?: string;
      difficulty?: string;
    },
    requestingUser?: { id?: string; role?: string },
  ): Promise<QuestionDocument[] | any[]> {
    const filter: Record<string, unknown> = {};

    if (filterOptions?.authorId) {
      if (Types.ObjectId.isValid(filterOptions.authorId)) {
        filter.author = new Types.ObjectId(filterOptions.authorId);
      }
    }

    if (filterOptions?.tag) {
      filter.tags = filterOptions.tag;
    }

    if (filterOptions?.difficulty) {
      filter.difficulty = filterOptions.difficulty;
    }

    if (filterOptions?.search) {
      filter.questionText = {
        $regex: escapeRegex(filterOptions.search.trim()),
        $options: 'i',
      };
    }

    const questions = await this.questionRepository.findWithDetails(filter);
    const isPrivileged =
      requestingUser?.role === 'admin' ||
      (requestingUser?.id && filterOptions?.authorId === requestingUser.id);

    if (!isPrivileged) {
      return questions.map((q) => this.sanitizeQuestion(q));
    }

    return questions;
  }

  async findOne(
    id: string,
    requestingUser?: { id?: string; role?: string },
  ): Promise<QuestionDocument | Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid question ID');
    }
    const question = await this.questionRepository.findByIdWithDetails(id);

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const isAuthor =
      requestingUser?.id &&
      (question.author?._id
        ? question.author._id.toString() === requestingUser.id
        : question.author?.toString() === requestingUser.id);
    const isAdmin = requestingUser?.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return this.sanitizeQuestion(question);
    }

    return question;
  }

  async update(
    id: string,
    authorId: string,
    dto: UpdateQuestionDto,
    isAdmin = false,
  ): Promise<QuestionDocument> {
    const question = await this.questionRepository.findByIdWithDetails(id);
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const authorMatches =
      question.author &&
      ((question.author as any)._id
        ? String((question.author as any)._id) === authorId
        : (question.author as any).toString() === authorId);

    if (!isAdmin && !authorMatches) {
      throw new ForbiddenException('Not authorized to update this question');
    }

    if (dto.questionText !== undefined)
      question.questionText = dto.questionText;
    if (dto.type !== undefined) question.type = dto.type;
    if (dto.timeLimit !== undefined) question.timeLimit = dto.timeLimit;
    if (dto.points !== undefined) question.points = dto.points;
    if (dto.mediaUrl !== undefined) question.mediaUrl = dto.mediaUrl;
    if (dto.tags !== undefined) question.tags = dto.tags;
    if (dto.difficulty !== undefined) question.difficulty = dto.difficulty;
    if (dto.choices !== undefined) {
      question.choices = dto.choices as unknown as QuizChoice[];
    }

    return question.save();
  }

  async delete(
    id: string,
    authorId: string,
    isAdmin = false,
  ): Promise<{ success: boolean }> {
    const question = await this.questionRepository.findByIdWithDetails(id);
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const authorMatches =
      question.author &&
      ((question.author as any)._id
        ? String((question.author as any)._id) === authorId
        : (question.author as any).toString() === authorId);

    if (!isAdmin && !authorMatches) {
      throw new ForbiddenException('Not authorized to delete this question');
    }

    await this.questionRepository.findByIdAndDelete(id);
    return { success: true };
  }
}
