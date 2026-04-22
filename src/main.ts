import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips any fields not in DTO
      forbidNonWhitelisted: true, //  rejects requests with extra fields
      transform: true, // transform plain object to DTO Class instance
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
