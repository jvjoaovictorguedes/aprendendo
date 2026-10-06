import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Qual franquia (tenant) este build do app representa. Cada franquia tem o
// próprio catálogo no mesmo banco compartilhado — esse header é o que o
// RLS do SCHEMA.sql usa (public.request_tenant_id()) pra nunca misturar o
// catálogo de uma franquia com o de outra, mesmo sem login.
export const appTenantId = process.env.EXPO_PUBLIC_TENANT_ID || null;

/** Há um projeto Supabase configurado (o painel admin precisa só disso). */
export const isSupabaseAvailable = Boolean(supabaseUrl && supabaseAnonKey);

/** O app do cliente consulta o catálogo real (precisa também da franquia). */
export const isSupabaseConfigured = Boolean(isSupabaseAvailable && appTenantId);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase não configurado (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / EXPO_PUBLIC_TENANT_ID ausentes). ' +
      'O app vai usar o catálogo local (src/data/products.ts) como alternativa.',
  );
}

export const supabase = isSupabaseAvailable
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        // Só o painel admin faz login pelo Supabase Auth; o cliente do app
        // ainda usa o login próprio (AuthContext).
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: {
        headers: appTenantId ? { 'x-tenant-id': appTenantId } : {},
      },
    })
  : null;
