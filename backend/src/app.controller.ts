// backend/src/app.controller.ts
import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service';

@Controller()
export class AppController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  getHello(): string {
    return 'Backend NestJS per AI Sales Assistant è attivo!';
  }

  // NUOVO HEALTH CHECK, come suggerito da Claude
  @Get('health')
  healthCheck() {
    return { 
      status: 'ok', 
      service: 'nestjs-backend', // Ci dice chi sta rispondendo
      timestamp: new Date().toISOString()
    };
  }

  @Get('test-db')
  async testDatabaseConnection() {
    try {
      const tableName = 'Name'; 
      const { data, error } = await this.supabaseService.supabase
        .from(tableName) 
        .select('*')
        .limit(5);

      if (error) {
        throw new HttpException(`Errore del database: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      
      return {
        message: 'Connessione al database e query eseguita con successo!',
        data: data,
      };
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      throw new HttpException('Errore interno del server.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}