import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppModule } from './../src/app.module';

describe('Auth & Users (e2e)', () => {
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

  it('/api/users/leaderboard (GET) - should return 200 and leaderboard array', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/leaderboard')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('/api/auth/register (POST) - should reject invalid registration input with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        username: 'ab', // too short
        password: '123', // too short
      })
      .expect(400);
  });

  it('/api/auth/login (POST) - should return 401 for nonexistent credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        emailOrUsername: 'nonexistent_user_99999',
        password: 'wrong_password_123',
      })
      .expect(401);
  });

  it('/api/users/me (PATCH) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .send({ username: 'newname' })
      .expect(401);
  });

  it('/api/auth/change-password (POST) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .send({
        currentPassword: 'old',
        newPassword: 'newpassword123',
      })
      .expect(401);
  });

  it('/api/users/me (DELETE) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer()).delete('/api/users/me').expect(401);
  });

  it('/api/auth/verify-email (POST) - should reject invalid verification token with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: 'invalid_token_xyz' })
      .expect(400);
  });

  it('/api/auth/resend-verification (POST) - should handle resend request and reject invalid email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/resend-verification')
      .send({ email: 'not-an-email' })
      .expect(400);

    const res = await request(app.getHttpServer())
      .post('/api/auth/resend-verification')
      .send({ email: 'someuser@example.com' })
      .expect(201);

    expect(res.body.success).toBe(true);
  });

  it('/api/auth/forgot-password (POST) - should handle request and reject invalid email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'bad-email' })
      .expect(400);

    const res = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'user@example.com' })
      .expect(201);

    expect(res.body.success).toBe(true);
  });

  it('/api/auth/reset-password (POST) - should reject invalid token or weak password with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'any-token', newPassword: '123' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'nonexistent-token', newPassword: 'newpassword123' })
      .expect(400);
  });

  it('/api/users/me/activity (POST) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/users/me/activity')
      .expect(401);
  });

  it('/api/users/me/hearts/refill (POST) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/users/me/hearts/refill')
      .expect(401);
  });

  it('/api/users/me/hearts/consume (POST) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/users/me/hearts/consume')
      .expect(401);
  });

  it('/api/users/me/streak/freeze (POST) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/users/me/streak/freeze')
      .expect(401);
  });

  it('/api/admin/users (GET) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer()).get('/api/admin/users').expect(401);
  });

  it('/api/admin/users/:id (GET) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/users/dummy-id')
      .expect(401);
  });

  it('/api/admin/users/:id/role (PATCH) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/users/dummy-id/role')
      .send({ role: 'teacher' })
      .expect(401);
  });

  it('/api/admin/users/:id/status (PATCH) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/users/dummy-id/status')
      .send({ isActive: false })
      .expect(401);
  });

  it('/api/admin/users/:id (DELETE) - should reject unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .delete('/api/admin/users/dummy-id')
      .expect(401);
  });
});
