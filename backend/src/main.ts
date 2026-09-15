import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS for Next.js frontend (supports localhost, Vercel deployments, custom domain)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!requestOrigin) return callback(null, true);
      // Allow explicitly listed origins
      if (allowedOrigins.includes(requestOrigin)) {
        return callback(null, true);
      }
      // Allow all Vercel preview deployments
      if (requestOrigin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend CQP 22 chạy tại: http://localhost:${port}/api`);
  console.log(`📚 Admin: ${process.env.ADMIN_USERNAME || 'giaovien'} / ${process.env.ADMIN_PASSWORD || 'cqp22admin'}`);
}
bootstrap();
