import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { Quiz, QuizDocument } from '../schemas/quiz.schema';

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
