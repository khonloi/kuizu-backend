import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CourseDocument, Lesson } from './schemas/course.schema';
import { GamificationService } from '../gamification/gamification.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { CourseRepository, UserProgressRepository } from './repositories';

@Injectable()
export class CoursesService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly progressRepository: UserProgressRepository,
    private readonly gamificationService: GamificationService,
  ) {}

  async findAll(): Promise<CourseDocument[]> {
    return this.courseRepository.findPublished();
  }

  async findAllAdmin(): Promise<CourseDocument[]> {
    return this.courseRepository.findAllCourses();
  }

  async findBySlug(slug: string): Promise<CourseDocument> {
    const course = await this.courseRepository.findBySlug(slug);
    if (!course) {
      throw new NotFoundException(`Course '${slug}' not found`);
    }
    return course;
  }

  async findById(id: string): Promise<CourseDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid course ID format`);
    }
    const course = await this.courseRepository.findById(id);
    if (!course) {
      throw new NotFoundException(`Course with ID '${id}' not found`);
    }
    return course;
  }

  async create(dto: CreateCourseDto): Promise<CourseDocument> {
    const existing = await this.courseRepository.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException(
        `Course with slug '${dto.slug}' already exists`,
      );
    }
    return this.courseRepository.createCourse(dto);
  }

  async update(id: string, dto: UpdateCourseDto): Promise<CourseDocument> {
    const course = await this.findById(id);

    if (dto.slug && dto.slug !== course.slug) {
      const existing = await this.courseRepository.findBySlug(dto.slug);
      if (existing) {
        throw new ConflictException(
          `Course with slug '${dto.slug}' already exists`,
        );
      }
    }

    Object.assign(course, dto);
    return course.save();
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    await this.findById(id);
    await this.courseRepository.deleteCourse(id);
    return {
      success: true,
      message: 'Course deleted successfully',
    };
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
    let progress = await this.progressRepository.findByUserAndCourse(
      userId,
      courseSlug,
    );

    if (!progress) {
      progress = await this.progressRepository.createProgress({
        user: new Types.ObjectId(userId),
        courseSlug,
        completedLessonIds: [],
        totalXpEarned: 0,
        currentUnit: 1,
      });
    }

    return progress;
  }

  async completeLesson(
    userId: string,
    courseSlug: string,
    lessonId: string,
    xp = 15,
  ) {
    let progress = await this.progressRepository.findByUserAndCourse(
      userId,
      courseSlug,
    );

    if (!progress) {
      progress = await this.progressRepository.createProgress({
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
    await this.gamificationService.addXp(userId, xp);

    return {
      success: true,
      xpEarned: xp,
      progress,
    };
  }

  async getEnrichedCurriculum(userId: string, courseSlug: string) {
    const course = await this.findBySlug(courseSlug);
    const progress = await this.getUserProgress(userId, courseSlug);

    const completedSet = new Set(progress.completedLessonIds || []);
    let nextAvailableUnlocked = true;

    const enrichedUnits = course.units.map((unit) => {
      const enrichedLessons = unit.lessons.map((lesson) => {
        const isCompleted = completedSet.has(lesson.id);
        const isLocked = !isCompleted && !nextAvailableUnlocked;

        if (!isCompleted && nextAvailableUnlocked) {
          nextAvailableUnlocked = false;
        }

        return {
          id: lesson.id,
          title: lesson.title,
          icon: lesson.icon,
          order: lesson.order,
          xpReward: lesson.xpReward,
          exerciseCount: lesson.exercises?.length || 0,
          isCompleted,
          isLocked,
          isCurrent: !isCompleted && !isLocked,
        };
      });

      return {
        id: unit.id,
        title: unit.title,
        description: unit.description,
        color: unit.color,
        order: unit.order,
        lessons: enrichedLessons,
      };
    });

    return {
      course: {
        id: course._id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        icon: course.icon,
        isPublished: course.isPublished,
      },
      progress: {
        completedLessonIds: progress.completedLessonIds,
        totalXpEarned: progress.totalXpEarned,
        currentUnit: progress.currentUnit,
      },
      units: enrichedUnits,
    };
  }
}
