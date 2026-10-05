import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
   
  console.warn(
    'Supabase não configurado (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY ausentes). ' +
      'O app vai usar o catálogo local (src/data/products.ts) como alternativa.',
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        // Autenticação do app é feita por conta própria (AuthContext); não
        // precisamos do sistema de auth do Supabase nem de persistir sessão dele.
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
