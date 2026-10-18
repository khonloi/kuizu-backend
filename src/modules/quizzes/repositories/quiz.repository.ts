import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { Quiz, QuizDocument } from '../schemas/quiz.schema';
import {
  PaginationQueryInputDto,
  PaginatedResponse,
} from '../../../common/dto';

const ALLOWED_QUIZ_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'title',
  'playCount',
]);

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
    return this.paginate(filter, query, {
      searchFields: ['title', 'description'],
      allowedSortFields: ALLOWED_QUIZ_SORT_FIELDS,
      populate: [
        { path: 'author', select: 'username avatarUrl' },
        { path: 'questions' },
      ],
    });
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
