import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { QuizDocument } from './schemas/quiz.schema';
import { Question } from './schemas/question.schema';
import { CreateQuizDto, UpdateQuizDto } from './dto/quiz.dto';
import { CreateQuestionDto } from './dto/question.dto';
import { QuizRepository, QuestionRepository } from './repositories';
import { PaginationQueryInputDto, PaginatedResponse } from '../../common/dto';

@Injectable()
export class QuizzesService {
  constructor(
    private readonly quizRepository: QuizRepository,
    private readonly questionRepository: QuestionRepository,
  ) {}

  private async resolveQuestionIds(
    authorId: string,
    questionIds?: string[],
    questions?: (string | CreateQuestionDto)[],
  ): Promise<Types.ObjectId[]> {
    const resolvedIds: Types.ObjectId[] = [];

    if (questionIds && questionIds.length > 0) {
      for (const id of questionIds) {
        if (!Types.ObjectId.isValid(id)) {
          throw new BadRequestException(`Invalid question ID: ${id}`);
        }
        resolvedIds.push(new Types.ObjectId(id));
      }
    }

    if (questions && questions.length > 0) {
      for (const item of questions) {
        if (typeof item === 'string') {
          if (!Types.ObjectId.isValid(item)) {
            throw new BadRequestException(`Invalid question ID: ${item}`);
          }
          resolvedIds.push(new Types.ObjectId(item));
        } else if (item && typeof item === 'object') {
          const savedQuestion = await this.questionRepository.create({
            ...item,
            author: new Types.ObjectId(authorId),
          });
          resolvedIds.push(savedQuestion._id as Types.ObjectId);
        }
      }
    }

    // Deduplicate while preserving order
    const seen = new Set<string>();
    return resolvedIds.filter((id) => {
      const key = id.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async create(authorId: string, dto: CreateQuizDto): Promise<QuizDocument> {
    const questionObjectIds = await this.resolveQuestionIds(
      authorId,
      dto.questionIds,
      dto.questions,
    );

    const saved = await this.quizRepository.create({
      title: dto.title,
      description: dto.description ?? '',
      coverImage: dto.coverImage ?? '',
      isPublic: dto.isPublic ?? true,
      questions: questionObjectIds,
      author: new Types.ObjectId(authorId),
    });

    return this.findOne(saved._id.toString());
  }

  async findAll(
    includePrivate = false,
    authorId?: string,
    query?: PaginationQueryInputDto,
  ): Promise<PaginatedResponse<QuizDocument> | QuizDocument[]> {
    const filter: Record<string, unknown> = {};
    if (!includePrivate) {
      filter.isPublic = true;
    }
    if (authorId) {
      if (Types.ObjectId.isValid(authorId)) {
        filter.author = new Types.ObjectId(authorId);
      }
    }
    if (!query) {
      return this.quizRepository.findWithDetails(filter);
    }
    return this.quizRepository.findPaginatedWithDetails(filter, query);
  }

  async findAllAdmin(
    query?: PaginationQueryInputDto,
  ): Promise<PaginatedResponse<QuizDocument> | QuizDocument[]> {
    if (!query) {
      return this.quizRepository.findWithDetails({});
    }
    return this.quizRepository.findPaginatedWithDetails({}, query);
  }

  async findOne(id: string): Promise<QuizDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid quiz ID');
    }
    const quiz = await this.quizRepository.findByIdWithDetails(id);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    return quiz;
  }

  async update(
    id: string,
    authorId: string,
    dto: UpdateQuizDto,
    isAdmin = false,
  ): Promise<QuizDocument> {
    const quiz = await this.findOne(id);
    const authorMatches =
      quiz.author &&
      (quiz.author._id
        ? quiz.author._id.toString() === authorId
        : quiz.author.toString() === authorId);

    if (!isAdmin && !authorMatches) {
      throw new ForbiddenException('Not authorized to update this quiz');
    }

    if (dto.title !== undefined) quiz.title = dto.title;
    if (dto.description !== undefined) quiz.description = dto.description;
    if (dto.coverImage !== undefined) quiz.coverImage = dto.coverImage;
    if (dto.isPublic !== undefined) quiz.isPublic = dto.isPublic;

    if (dto.questionIds !== undefined || dto.questions !== undefined) {
      const questionObjectIds = await this.resolveQuestionIds(
        authorId,
        dto.questionIds,
        dto.questions,
      );
      quiz.questions = questionObjectIds as unknown as Question[];
    }

    await quiz.save();
    return this.findOne(id);
  }

  async delete(
    id: string,
    authorId: string,
    isAdmin = false,
  ): Promise<{ success: boolean }> {
    const quiz = await this.findOne(id);
    const authorMatches =
      quiz.author &&
      (quiz.author._id
        ? quiz.author._id.toString() === authorId
        : quiz.author.toString() === authorId);

    if (!isAdmin && !authorMatches) {
      throw new ForbiddenException('Not authorized to delete this quiz');
    }

    await this.quizRepository.findByIdAndDelete(id);
    return { success: true };
  }

  async incrementPlayCount(id: string): Promise<void> {
    await this.quizRepository.incrementPlayCount(id);
  }
}
