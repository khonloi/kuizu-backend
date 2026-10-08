import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppModule } from './../src/app.module';

describe('CoursesController (e2e)', () => {
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

  it('/api/courses (GET) - should return 200 and array of published courses', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/courses')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('/api/courses (POST) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/courses')
      .send({
        title: 'Unauthorized Course',
        slug: 'unauthorized-course',
        units: [],
      })
      .expect(401);
  });

  it('/api/courses/:slug (GET) - should return 404 for nonexistent course', async () => {
    await request(app.getHttpServer())
      .get('/api/courses/non-existent-course-slug-12345')
      .expect(404);
  });
});
