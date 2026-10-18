import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { getAllowedCorsOrigins } from './config/cors.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  const clientUrl =
    configService.get<string>('CLIENT_URL') || 'http://localhost:3001';
  const corsAllowedOrigins = configService.get<string>('CORS_ALLOWED_ORIGINS');
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  // Compute allowed CORS origins dynamically
  const allowedOrigins: string[] = getAllowedCorsOrigins(
    corsAllowedOrigins,
    clientUrl,
    isProd,
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // API Versioning (URI based: /api/v1/...)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(new ZodValidationPipe());

  // Security middlewares
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Swagger Documentation (only in non-production or when explicitly enabled)
  const enableSwagger = configService.get<string>('ENABLE_SWAGGER') === 'true';

  if (!isProd || enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Kuizu API')
      .setDescription(
        'Full-stack gamified learning & multiplayer quiz engine (Duolingo + Kahoot clone)',
      )
      .setVersion('2.0.0')
      .addBearerAuth()
      .addCookieAuth('access_token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Attach distributed Redis WebSocket adapter if REDIS_URI is present
  const redisUri = configService.get<string>('REDIS_URI');
  if (redisUri) {
    const redisIoAdapter = new RedisIoAdapter(app);
    const connected = await redisIoAdapter.connectToRedis(redisUri);
    if (connected) {
      app.useWebSocketAdapter(redisIoAdapter);
    }
  }

  await app.listen(port);
  logger.log(
    `🚀 Kuizu Backend API running at: http://localhost:${port}/api/v1`,
  );
  if (!isProd || enableSwagger) {
    logger.log(
      `📖 Swagger API Docs accessible at: http://localhost:${port}/api/docs`,
    );
  }
  logger.log(`🎮 Socket.IO Gateway active`);
}

void bootstrap();
