import { INestApplication, ValidationPipe } from '@nestjs/common';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';

/** Cấu hình dùng chung cho main.ts và test e2e (ADR 006, ADR 008). */
export function configureApp(app: INestApplication): void {
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const logger = new RequestLoggerMiddleware();
  app.use(logger.use.bind(logger));
}
