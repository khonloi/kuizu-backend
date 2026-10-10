import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { Quiz, QuizDocument } from '../schemas/quiz.schema';
import {
  PaginationQueryInputDto,
  PaginatedResponse,
  createOffsetPaginatedResponse,
  createCursorPaginatedResponse,
} from '../../../common/dto';

@Injectable()
export class QuizRepository extends BaseRepository<QuizDocument> {
  constructor(
    @InjectModel(Quiz.name)
    quizModel: Model<QuizDocument>,
  ) {
    super(quizModel);
  }

  async findWithDetails(
    filter: QueryFilter<QuizDocument> = {},
  ): Promise<QuizDocument[]> {
    return this.model
      .find(filter)
      .populate('author', 'username avatarUrl')
      .populate('questions')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findPaginatedWithDetails(
    filter: QueryFilter<QuizDocument> = {},
    query: PaginationQueryInputDto = {},
  ): Promise<PaginatedResponse<QuizDocument>> {
    const mongoFilter: Record<string, unknown> = { ...filter };
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
    const isCursorMode = query.mode === 'cursor' || Boolean(query.cursor);

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      mongoFilter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    if (isCursorMode) {
      if (query.cursor && Types.ObjectId.isValid(query.cursor)) {
        mongoFilter._id = { $lt: new Types.ObjectId(query.cursor) };
      }
      const items = await this.model
        .find(mongoFilter)
        .populate('author', 'username avatarUrl')
        .populate('questions')
        .sort({ _id: -1 })
        .limit(limit + 1)
        .exec();

      return createCursorPaginatedResponse(items, limit);
    }

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [total, data] = await Promise.all([
      this.model.countDocuments(mongoFilter).exec(),
      this.model
        .find(mongoFilter)
        .populate('author', 'username avatarUrl')
        .populate('questions')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    return createOffsetPaginatedResponse(data, total, page, limit);
  }

  async findByIdWithDetails(id: string): Promise<QuizDocument | null> {
    return this.model
      .findById(id)
      .populate('author', 'username avatarUrl')
      .populate('questions')
      .exec();
  }

  async incrementPlayCount(id: string): Promise<void> {
    await this.model.findByIdAndUpdate(id, { $inc: { playCount: 1 } }).exec();
  }
}
