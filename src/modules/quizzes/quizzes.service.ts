import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quiz, QuizDocument } from './schemas/quiz.schema';
import { CreateQuizDto } from './dto/quiz.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<QuizDocument>,
  ) {}

  async create(authorId: string, dto: CreateQuizDto): Promise<QuizDocument> {
    const quiz = new this.quizModel({
      ...dto,
      author: new Types.ObjectId(authorId),
    });
    return quiz.save();
  }

  async findAll(includePrivate = false, authorId?: string): Promise<QuizDocument[]> {
    const filter: Record<string, unknown> = {};
    if (!includePrivate) {
      filter.isPublic = true;
    }
    if (authorId) {
      filter.author = new Types.ObjectId(authorId);
    }
    return this.quizModel
      .find(filter)
      .populate('author', 'username avatarUrl')
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
      .exec();
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    return quiz;
  }

  async update(id: string, authorId: string, dto: Partial<CreateQuizDto>): Promise<QuizDocument> {
    const quiz = await this.findOne(id);
    if (quiz.author._id.toString() !== authorId) {
      throw new ForbiddenException('Not authorized to update this quiz');
    }
    Object.assign(quiz, dto);
    return quiz.save();
  }

  async delete(id: string, authorId: string): Promise<{ success: boolean }> {
    const quiz = await this.findOne(id);
    if (quiz.author._id.toString() !== authorId) {
      throw new ForbiddenException('Not authorized to delete this quiz');
    }
    await this.quizModel.findByIdAndDelete(id).exec();
    return { success: true };
  }

  async incrementPlayCount(id: string): Promise<void> {
    await this.quizModel.findByIdAndUpdate(id, { $inc: { playCount: 1 } });
  }
}
