// backend/src/supabase/supabase.service.ts

import { Injectable } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  public readonly supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL or Key not found in .env file. Make sure the file exists and is configured.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized successfully.');
  }
}