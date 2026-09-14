import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS for Next.js frontend (supports localhost, Vercel deployments, custom domain)
  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!requestOrigin) return callback(null, true);
      const frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl || frontendUrl === '*' || requestOrigin === frontendUrl) {
        return callback(null, true);
      }
      if (requestOrigin.endsWith('.vercel.app') || requestOrigin.includes('localhost')) {
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
