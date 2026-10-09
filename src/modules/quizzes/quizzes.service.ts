import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quiz, QuizDocument } from './schemas/quiz.schema';
import { Question, QuestionDocument } from './schemas/question.schema';
import { CreateQuizDto, UpdateQuizDto } from './dto/quiz.dto';
import { CreateQuestionDto } from './dto/question.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<QuizDocument>,
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
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
          const newQuestion = new this.questionModel({
            ...item,
            author: new Types.ObjectId(authorId),
          });
          const savedQuestion = await newQuestion.save();
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

    const quiz = new this.quizModel({
      title: dto.title,
      description: dto.description ?? '',
      coverImage: dto.coverImage ?? '',
      isPublic: dto.isPublic ?? true,
      questions: questionObjectIds,
      author: new Types.ObjectId(authorId),
    });

    const saved = await quiz.save();
    return this.findOne(saved._id.toString());
  }

  async findAll(
    includePrivate = false,
    authorId?: string,
  ): Promise<QuizDocument[]> {
    const filter: Record<string, unknown> = {};
    if (!includePrivate) {
      filter.isPublic = true;
    }
    if (authorId) {
      if (Types.ObjectId.isValid(authorId)) {
        filter.author = new Types.ObjectId(authorId);
      }
    }
    return this.quizModel
      .find(filter)
      .populate('author', 'username avatarUrl')
      .populate('questions')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllAdmin(): Promise<QuizDocument[]> {
    return this.quizModel
      .find()
      .populate('author', 'username avatarUrl')
      .populate('questions')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<QuizDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid quiz ID');
    }
    const quiz = await this.quizModel
      .findById(id)
      .populate('author', 'username avatarUrl')
      .populate('questions')
      .exec();
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

    await this.quizModel.findByIdAndDelete(id).exec();
    return { success: true };
  }

  async incrementPlayCount(id: string): Promise<void> {
    await this.quizModel.findByIdAndUpdate(id, { $inc: { playCount: 1 } });
  }
}
