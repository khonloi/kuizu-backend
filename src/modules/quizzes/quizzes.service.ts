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

    const validateAndAddQuestionId = async (id: string) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid question ID: ${id}`);
      }
      const existing = await this.questionRepository.findByIdWithDetails(id);
      if (!existing) {
        throw new NotFoundException(`Question not found: ${id}`);
      }
      const isOwner =
        existing.author &&
        ((existing.author as any)._id
          ? String((existing.author as any)._id) === authorId
          : String(existing.author) === authorId);

      if (existing.author && !isOwner) {
        throw new ForbiddenException(
          `Cannot add question '${id}' owned by another user`,
        );
      }
      resolvedIds.push(new Types.ObjectId(id));
    };

    if (questionIds && questionIds.length > 0) {
      for (const id of questionIds) {
        await validateAndAddQuestionId(id);
      }
    }

    if (questions && questions.length > 0) {
      for (const item of questions) {
        if (typeof item === 'string') {
          await validateAndAddQuestionId(item);
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

  private sanitizeQuiz(quiz: any): any {
    if (!quiz) return quiz;
    const quizObj =
      typeof quiz.toObject === 'function' ? quiz.toObject() : { ...quiz };
    if (Array.isArray(quizObj.questions)) {
      quizObj.questions = quizObj.questions.map((q: any) => {
        const qObj =
          typeof q?.toObject === 'function' ? q.toObject() : { ...q };
        if (Array.isArray(qObj.choices)) {
          qObj.choices = qObj.choices.map((c: any) => {
            const { isCorrect: _isCorrect, ...rest } = c;
            return rest;
          });
        }
        return qObj;
      });
    }
    return quizObj;
  }

  async findAll(
    includePrivate = false,
    authorId?: string,
    query?: PaginationQueryInputDto,
  ): Promise<
    | PaginatedResponse<QuizDocument | Record<string, unknown>>
    | (QuizDocument | Record<string, unknown>)[]
  > {
    const filter: Record<string, unknown> = {};
    if (!includePrivate) {
      filter.isPublic = true;
    }
    if (authorId) {
      if (Types.ObjectId.isValid(authorId)) {
        filter.author = new Types.ObjectId(authorId);
      }
    }
    const result = !query
      ? await this.quizRepository.findWithDetails(filter)
      : await this.quizRepository.findPaginatedWithDetails(filter, query);

    if (!includePrivate) {
      if (Array.isArray(result)) {
        return result.map((q) => this.sanitizeQuiz(q));
      }
      return {
        ...result,
        data: result.data.map((q) => this.sanitizeQuiz(q)),
      };
    }
    return result;
  }

  async findAllAdmin(
    query?: PaginationQueryInputDto,
  ): Promise<PaginatedResponse<QuizDocument> | QuizDocument[]> {
    if (!query) {
      return this.quizRepository.findWithDetails({});
    }
    return this.quizRepository.findPaginatedWithDetails({}, query);
  }

  async findOne(
    id: string,
    requestingUser?: { id?: string; role?: string },
    sanitize?: false,
  ): Promise<QuizDocument>;
  async findOne(
    id: string,
    requestingUser: { id?: string; role?: string } | undefined,
    sanitize: true,
  ): Promise<QuizDocument | Record<string, unknown>>;
  async findOne(
    id: string,
    requestingUser?: { id?: string; role?: string },
    sanitize = false,
  ): Promise<QuizDocument | Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid quiz ID');
    }
    const quiz = await this.quizRepository.findByIdWithDetails(id);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const isAuthor =
      requestingUser?.id &&
      (quiz.author?._id
        ? quiz.author._id.toString() === requestingUser.id
        : quiz.author?.toString() === requestingUser.id);
    const isAdmin = requestingUser?.role === 'admin';

    if (quiz.isPublic === false && !isAuthor && !isAdmin) {
      throw new NotFoundException('Quiz not found');
    }

    if (sanitize && !isAuthor && !isAdmin) {
      return this.sanitizeQuiz(quiz);
    }

    return quiz;
  }

  async update(
    id: string,
    authorId: string,
    dto: UpdateQuizDto,
    isAdmin = false,
  ): Promise<QuizDocument> {
    const userContext = { id: authorId, role: isAdmin ? 'admin' : 'user' };
    const quiz = await this.findOne(id, userContext);
    const authorMatches =
      quiz.author &&
      ((quiz.author as any)._id
        ? String((quiz.author as any)._id) === authorId
        : (quiz.author as any).toString() === authorId);

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
    return this.findOne(id, userContext);
  }

  async delete(
    id: string,
    authorId: string,
    isAdmin = false,
  ): Promise<{ success: boolean }> {
    const userContext = { id: authorId, role: isAdmin ? 'admin' : 'user' };
    const quiz = await this.findOne(id, userContext);
    const authorMatches =
      quiz.author &&
      ((quiz.author as any)._id
        ? String((quiz.author as any)._id) === authorId
        : (quiz.author as any).toString() === authorId);

    if (!isAdmin && !authorMatches) {
      throw new ForbiddenException('Not authorized to delete this quiz');
    }

    if (
      quiz.questions &&
      Array.isArray(quiz.questions) &&
      quiz.questions.length > 0
    ) {
      const questionIds = quiz.questions.map((q: any) =>
        q?._id ? q._id.toString() : q.toString(),
      );
      if (
        typeof (this.quizRepository as any).find === 'function' &&
        typeof (this.questionRepository as any).deleteMany === 'function'
      ) {
        const otherQuizzes = await this.quizRepository.find({
          _id: { $ne: quiz._id },
          questions: {
            $in: questionIds
              .filter((qid: string) => Types.ObjectId.isValid(qid))
              .map((qid: string) => new Types.ObjectId(qid)),
          },
        });
        const retainedSet = new Set<string>();
        for (const oq of otherQuizzes) {
          if (oq.questions) {
            for (const q of oq.questions) {
              const qIdStr = ((q as any)?._id ?? q)?.toString();
              if (qIdStr) {
                retainedSet.add(qIdStr);
              }
            }
          }
        }
        const orphanedIds = questionIds.filter(
          (qid: string) => !retainedSet.has(qid) && Types.ObjectId.isValid(qid),
        );
        if (orphanedIds.length > 0) {
          await this.questionRepository.deleteMany({
            _id: { $in: orphanedIds.map((qid) => new Types.ObjectId(qid)) },
          });
        }
      }
    }

    await this.quizRepository.findByIdAndDelete(id);
    return { success: true };
  }

  async incrementPlayCount(id: string): Promise<void> {
    await this.quizRepository.incrementPlayCount(id);
  }
}
