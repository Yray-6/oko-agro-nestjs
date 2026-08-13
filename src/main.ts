import './config/decimal.config'; // ✅ Decimal global config
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded, Request } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // bodyParser: false — parsing is done explicitly below so the raw bytes
  // can be captured for webhook signature verification (AgroTrack -> Oko).
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // ✅ Enable CORS
  app.enableCors({ origin: '*' });

  // Increase payload size limit (e.g., 50MB). The verify callback stashes
  // the exact raw bytes on the request — AgroTrackWebhookGuard signs/checks
  // against these, not a re-serialized copy of the parsed body.
  app.use(
    json({
      limit: '50mb',
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields
      forbidNonWhitelisted: true, // throws error if extra fields present
      transform: true, // auto-transform payloads to DTO classes
    }),
  );

  // Swagger config
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('OKO-AGRO API')
      .setDescription('API DOC FOR OKO-AGRO')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('swagger', app, document);

  await app.listen(
    process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    '0.0.0.0',
  );
}
bootstrap();
