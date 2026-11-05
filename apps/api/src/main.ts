import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig } from './config/app-config.service';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(AppConfig);
  configureApp(app);
  app.enableCors({ origin: config.get('WEB_ORIGIN').split(','), credentials: true });

  const io = new RedisIoAdapter(app, config.get('REDIS_URL'), config.get('WEB_ORIGIN'));
  await io.connectToRedis();
  app.useWebSocketAdapter(io);

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('GFS TMS API')
      .setDescription('Transportation Management System — REST API. Live tracking is served over Socket.IO.')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, doc, { swaggerOptions: { persistAuthorization: true } });

  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`API ready on http://localhost:${port}/api  ·  docs: http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
