import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../modules/users/schemas/user.schema';
import { Course, CourseSchema } from '../modules/courses/schemas/course.schema';
import { Quiz, QuizSchema } from '../modules/quizzes/schemas/quiz.schema';
import { SeedService } from './seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class DatabaseModule {}
