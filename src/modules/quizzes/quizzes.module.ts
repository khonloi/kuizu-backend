import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Quiz, QuizSchema } from './schemas/quiz.schema';
import { Question, QuestionSchema } from './schemas/question.schema';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Quiz.name, schema: QuizSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  controllers: [QuizzesController, QuestionsController],
  providers: [QuizzesService, QuestionsService],
  exports: [QuizzesService, QuestionsService],
})
export class QuizzesModule {}
