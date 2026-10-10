import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import {
  UserProgress,
  UserProgressDocument,
} from '../schemas/user-progress.schema';

@Injectable()
export class UserProgressRepository extends BaseRepository<UserProgressDocument> {
  constructor(
    @InjectModel(UserProgress.name)
    progressModel: Model<UserProgressDocument>,
  ) {
    super(progressModel);
  }

  async findByUserAndCourse(
    userId: string | Types.ObjectId,
    courseSlug: string,
  ): Promise<UserProgressDocument | null> {
    const userObjectId =
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return this.findOne({
      user: userObjectId,
      courseSlug,
    });
  }

  async createProgress(
    data: Partial<UserProgress>,
  ): Promise<UserProgressDocument> {
    return this.create(data);
  }
}
