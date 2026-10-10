import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { Question, QuestionDocument } from '../schemas/question.schema';

@Injectable()
export class QuestionRepository extends BaseRepository<QuestionDocument> {
  constructor(
    @InjectModel(Question.name)
    questionModel: Model<QuestionDocument>,
  ) {
    super(questionModel);
  }

  async findWithDetails(
    filter: QueryFilter<QuestionDocument> = {},
  ): Promise<QuestionDocument[]> {
    return this.model
      .find(filter)
      .populate('author', 'username avatarUrl')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByIdWithDetails(id: string): Promise<QuestionDocument | null> {
    return this.model
      .findById(id)
      .populate('author', 'username avatarUrl')
      .exec();
  }
}
