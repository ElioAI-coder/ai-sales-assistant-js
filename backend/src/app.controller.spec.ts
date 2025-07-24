// Contenuto per il file di TEST: app.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseService } from './supabase/supabase.service'; // Importa il servizio

describe('AppController', () => {
  let appController: AppController;

  // Questo blocco viene eseguito prima di ogni test
  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      // Forniamo un "finto" SupabaseService per i test, per non connetterci realmente al DB
      providers: [AppService, { provide: SupabaseService, useValue: {} }], 
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  // Test di base
  describe('root', () => {
    it('should return "Backend NestJS per AI Sales Assistant è attivo!"', () => {
      expect(appController.getHello()).toBe('Backend NestJS per AI Sales Assistant è attivo!');
    });
  });
});