import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from './schemas/course.schema';
import {
  UserProgress,
  UserProgressSchema,
} from './schemas/user-progress.schema';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { GamificationModule } from '../gamification/gamification.module';
import { CourseRepository, UserProgressRepository } from './repositories';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: UserProgress.name, schema: UserProgressSchema },
    ]),
    GamificationModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CourseRepository, UserProgressRepository],
  exports: [CoursesService, CourseRepository, UserProgressRepository],
})
export class CoursesModule {}
