// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Leggiamo la porta dal file .env, con un valore di default di 3001
  const port = process.env.PORT || 3001;

  await app.listen(port);
  
  // Aggiungiamo un log che ci conferma su quale porta stiamo ascoltando
  console.log(`🚀 Backend NestJS in ascolto sulla porta: ${port}`);
}
bootstrap();