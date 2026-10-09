import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question, QuestionDocument } from './schemas/question.schema';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/question.dto';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
  ) {}

  async create(
    authorId: string,
    dto: CreateQuestionDto,
  ): Promise<QuestionDocument> {
    const question = new this.questionModel({
      ...dto,
      author: new Types.ObjectId(authorId),
    });
    return question.save();
  }

  async findAll(filterOptions?: {
    authorId?: string;
    tag?: string;
    search?: string;
    difficulty?: string;
  }): Promise<QuestionDocument[]> {
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
      filter.questionText = { $regex: filterOptions.search, $options: 'i' };
    }

    return this.questionModel
      .find(filter)
      .populate('author', 'username avatarUrl')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<QuestionDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid question ID');
    }
    const question = await this.questionModel
      .findById(id)
      .populate('author', 'username avatarUrl')
      .exec();

    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async update(
    id: string,
    authorId: string,
    dto: UpdateQuestionDto,
    isAdmin = false,
  ): Promise<QuestionDocument> {
    const question = await this.findOne(id);
    const authorMatches =
      question.author &&
      (question.author._id
        ? question.author._id.toString() === authorId
        : question.author.toString() === authorId);

    if (!isAdmin && !authorMatches) {
      throw new ForbiddenException('Not authorized to update this question');
    }

    Object.assign(question, dto);
    return question.save();
  }

  async delete(
    id: string,
    authorId: string,
    isAdmin = false,
  ): Promise<{ success: boolean }> {
    const question = await this.findOne(id);
    const authorMatches =
      question.author &&
      (question.author._id
        ? question.author._id.toString() === authorId
        : question.author.toString() === authorId);

    if (!isAdmin && !authorMatches) {
      throw new ForbiddenException('Not authorized to delete this question');
    }

    await this.questionModel.findByIdAndDelete(id).exec();
    return { success: true };
  }
}
