import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppModule } from './../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('services');
        expect(res.body.services).toHaveProperty('api');
        expect(res.headers).toHaveProperty('x-request-id');
      });
  });

  it('/api/health (GET) with custom X-Request-Id', () => {
    const customReqId = 'custom-trace-uuid-12345';
    return request(app.getHttpServer())
      .get('/api/health')
      .set('X-Request-Id', customReqId)
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-request-id']).toBe(customReqId);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
