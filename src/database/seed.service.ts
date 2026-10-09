import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../modules/users/schemas/user.schema';
import {
  Course,
  CourseDocument,
} from '../modules/courses/schemas/course.schema';
import { Quiz, QuizDocument } from '../modules/quizzes/schemas/quiz.schema';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<QuizDocument>,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.seedDefaults();
    } catch (err) {
      this.logger.warn(`Seed skipped or failed: ${(err as Error).message}`);
    }
  }

  async seedDefaults() {
    let demoUser = await this.userModel.findOne({ email: 'demo@kuizu.dev' });
    if (!demoUser) {
      const passwordHash = await bcrypt.hash('kuizu123', 12);
      demoUser = await this.userModel.create({
        email: 'demo@kuizu.dev',
        username: 'duo_master',
        passwordHash,
        role: 'user',
        xp: 450,
        streak: { count: 7, lastActiveDate: new Date() },
        hearts: 5,
        gems: 320,
        league: 'gold',
      });
      this.logger.log('Demo user seeded: demo@kuizu.dev (password: kuizu123)');
    }

    const existingCourse = await this.courseModel.findOne({
      slug: 'japanese-basics',
    });
    if (!existingCourse) {
      await this.courseModel.create({
        title: 'Japanese Foundations',
        slug: 'japanese-basics',
        description:
          'Master Hiragana, essential greetings, and everyday phrases!',
        icon: '🗾',
        isPublished: true,
        units: [
          {
            id: 'unit-1',
            title: 'Unit 1: Essential Greetings',
            description:
              'Learn to introduce yourself and say hello & thank you',
            color: '#58cc02',
            order: 1,
            lessons: [
              {
                id: 'lesson-1-1',
                title: 'Hello & Goodbye',
                icon: '👋',
                order: 1,
                xpReward: 20,
                exercises: [
                  {
                    id: 'ex-1',
                    type: 'multiple-choice',
                    prompt: 'Which word means "Hello" in Japanese?',
                    options: ['Konnichiwa', 'Sayonara', 'Arigatou', 'Oyasumi'],
                    answer: 'Konnichiwa',
                    hint: 'Standard daytime greeting',
                  },
                  {
                    id: 'ex-2',
                    type: 'translate',
                    prompt: 'Translate: "Thank you very much"',
                    options: [
                      'Arigatou gozaimasu',
                      'Gomen nasai',
                      'Konnichiwa',
                      'Hai',
                    ],
                    answer: 'Arigatou gozaimasu',
                    hint: 'Polite expression of gratitude',
                  },
                ],
              },
            ],
          },
        ],
      });
      this.logger.log('Sample Japanese Duolingo-style course seeded');
    }

    const existingQuiz = await this.quizModel.findOne({
      title: 'Web Tech & Pop Culture Quiz',
    });
    if (!existingQuiz && demoUser) {
      await this.quizModel.create({
        title: 'Web Tech & Pop Culture Quiz',
        description:
          'Test your knowledge on modern full-stack web dev and tech trivia!',
        coverImage:
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop',
        author: demoUser._id,
        isPublic: true,
        playCount: 12,
        questions: [
          {
            id: 'q1',
            questionText:
              'Which runtime was created by Ryan Dahl after Node.js?',
            type: 'multiple-choice',
            timeLimit: 20,
            points: 1000,
            choices: [
              { id: 'c1', text: 'Bun', isCorrect: false, color: 'red' },
              { id: 'c2', text: 'Deno', isCorrect: true, color: 'blue' },
              { id: 'c3', text: 'Electron', isCorrect: false, color: 'yellow' },
              { id: 'c4', text: 'V8 Direct', isCorrect: false, color: 'green' },
            ],
          },
          {
            id: 'q2',
            questionText: 'What does the "M" stand for in MERN stack?',
            type: 'multiple-choice',
            timeLimit: 15,
            points: 1000,
            choices: [
              { id: 'c5', text: 'MySQL', isCorrect: false, color: 'red' },
              { id: 'c6', text: 'MongoDB', isCorrect: true, color: 'blue' },
              { id: 'c7', text: 'MariaDB', isCorrect: false, color: 'yellow' },
              { id: 'c8', text: 'Memcached', isCorrect: false, color: 'green' },
            ],
          },
        ],
      });
      this.logger.log('Sample Kahoot-style quiz seeded');
    }
  }
}
