import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppModule } from './../src/app.module';

describe('Quizzes & Questions (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/quizzes (GET) - should return 200 and array of public quizzes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/quizzes')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('/api/quizzes (POST) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/quizzes')
      .send({
        title: 'Unauthorized Quiz',
        questions: [],
      })
      .expect(401);
  });

  it('/api/quizzes/:id (GET) - should return 404 for invalid or nonexistent quiz', async () => {
    await request(app.getHttpServer())
      .get('/api/quizzes/nonexistent-quiz-id')
      .expect(404);
  });

  it('/api/questions (GET) - should return 200 and array of questions', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/questions')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('/api/questions (POST) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/questions')
      .send({
        questionText: 'Unauthorized Question',
      })
      .expect(401);
  });

  it('/api/questions/:id (GET) - should return 404 for invalid or nonexistent question', async () => {
    await request(app.getHttpServer())
      .get('/api/questions/nonexistent-question-id')
      .expect(404);
  });
});
