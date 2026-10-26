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

  async completeLessonAtomic(
    userId: string | Types.ObjectId,
    courseSlug: string,
    lessonId: string,
    xpReward: number,
  ): Promise<{ progress: UserProgressDocument; isFirstCompletion: boolean }> {
    const userObjectId =
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const updated = await this.findOneAndUpdate(
      {
        user: userObjectId,
        courseSlug,
        completedLessonIds: { $ne: lessonId },
      },
      {
        $addToSet: { completedLessonIds: lessonId },
        $inc: { totalXpEarned: xpReward },
      },
      { new: true },
    );

    if (updated) {
      return { progress: updated, isFirstCompletion: true };
    }

    let existing = await this.findByUserAndCourse(userId, courseSlug);
    if (!existing) {
      existing = await this.create({
        user: userObjectId,
        courseSlug,
        completedLessonIds: [lessonId],
        totalXpEarned: xpReward,
        currentUnit: 1,
      });
      return { progress: existing, isFirstCompletion: true };
    }

    return { progress: existing, isFirstCompletion: false };
  }
}
