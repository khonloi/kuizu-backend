import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course, CourseDocument, Lesson } from './schemas/course.schema';
import { UserProgress, UserProgressDocument } from './schemas/user-progress.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(UserProgress.name) private readonly progressModel: Model<UserProgressDocument>,
    private readonly usersService: UsersService,
  ) {}

  async findAll(): Promise<CourseDocument[]> {
    return this.courseModel.find({ isPublished: true }).exec();
  }

  async findBySlug(slug: string): Promise<CourseDocument> {
    const course = await this.courseModel.findOne({ slug }).exec();
    if (!course) {
      throw new NotFoundException(`Course '${slug}' not found`);
    }
    return course;
  }

  async getLesson(courseSlug: string, lessonId: string) {
    const course = await this.findBySlug(courseSlug);
    for (const unit of course.units) {
      const lesson = unit.lessons.find((l: Lesson) => l.id === lessonId);
      if (lesson) {
        return {
          unit: { id: unit.id, title: unit.title, color: unit.color },
          lesson,
        };
      }
    }
    throw new NotFoundException(`Lesson '${lessonId}' not found`);
  }

  async getUserProgress(userId: string, courseSlug: string) {
    let progress = await this.progressModel.findOne({
      user: new Types.ObjectId(userId),
      courseSlug,
    });

    if (!progress) {
      progress = await this.progressModel.create({
        user: new Types.ObjectId(userId),
        courseSlug,
        completedLessonIds: [],
        totalXpEarned: 0,
        currentUnit: 1,
      });
    }

    return progress;
  }

  async completeLesson(userId: string, courseSlug: string, lessonId: string, xp = 15) {
    let progress = await this.progressModel.findOne({
      user: new Types.ObjectId(userId),
      courseSlug,
    });

    if (!progress) {
      progress = new this.progressModel({
        user: new Types.ObjectId(userId),
        courseSlug,
        completedLessonIds: [],
        totalXpEarned: 0,
        currentUnit: 1,
      });
    }

    if (!progress.completedLessonIds.includes(lessonId)) {
      progress.completedLessonIds.push(lessonId);
      progress.totalXpEarned += xp;
      await progress.save();
    }

    // Update user global XP
    await this.usersService.addXp(userId, xp);

    return {
      success: true,
      xpEarned: xp,
      progress,
    };
  }
}
