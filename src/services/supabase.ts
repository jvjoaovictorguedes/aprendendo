import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Qual franquia (tenant) este build do app representa. Cada franquia tem o
// próprio catálogo no mesmo banco compartilhado — esse header é o que o
// RLS do SCHEMA.sql usa (public.request_tenant_id()) pra nunca misturar o
// catálogo de uma franquia com o de outra, mesmo sem login.
const tenantId = process.env.EXPO_PUBLIC_TENANT_ID;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && tenantId);

if (!isSupabaseConfigured) {

  console.warn(
    'Supabase não configurado (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / EXPO_PUBLIC_TENANT_ID ausentes). ' +
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
      global: {
        headers: { 'x-tenant-id': tenantId as string },
      },
    })
  : null;
