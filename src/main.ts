import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

async function bootstrap() {
  const logger = new Logger('HTTP');

  // Create app and enable CORS. Configure allowed origins via env var CORS_ORIGIN (comma-separated).
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());

  const rawOrigins = process.env.CORS_ORIGIN;
  const origins = rawOrigins
    ? rawOrigins.split(',').map((s) => s.trim())
    : true; // true -> allow any origin (dev)

  app.enableCors({
    origin: origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`,
      );
    });

    next();
  });

  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/' });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
});
