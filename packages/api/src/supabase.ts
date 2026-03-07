import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@kakai/shared';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nhgcollyiqyexunvwywt.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZ2NvbGx5aXF5ZXh1bnZ3eXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5ODczNTgsImV4cCI6MjA4NzU2MzM1OH0.9owUaR7BMpDTsbeVoQATUGJfb6yVET-ZLefAEOiwnEM';

console.log('[Supabase] URL:', SUPABASE_URL);
console.log('[Supabase] KEY:', SUPABASE_ANON_KEY ? 'loaded' : 'MISSING');

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
