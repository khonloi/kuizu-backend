import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  const clientUrl = configService.get<string>('CLIENT_URL') || 'http://localhost:3001';

  // Global prefix
  app.setGlobalPrefix('api');

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
    origin: [clientUrl, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kuizu API')
    .setDescription('Full-stack gamified learning & multiplayer quiz engine (Duolingo + Kahoot clone)')
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

  await app.listen(port);
  logger.log(`🚀 Kuizu Backend API running at: http://localhost:${port}/api`);
  logger.log(`📖 Swagger API Docs accessible at: http://localhost:${port}/api/docs`);
  logger.log(`🎮 Socket.IO Gateway listening on namespace: /game`);
}

bootstrap();
