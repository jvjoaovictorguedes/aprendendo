// Edge Function "admin-users" — operações de conta que exigem a chave
// service_role (que NUNCA pode ir dentro do app): criar usuário, redefinir
// senha, bloquear/desbloquear.
//
// Só aceita chamadas de um usuário logado com papel platform_admin ativo.
// Deploy: npx supabase functions deploy admin-users
// (SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são
// injetadas automaticamente pelo Supabase.)

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_ROLES = ['platform_admin', 'tenant_admin'] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

// Bloqueio "permanente" (o Supabase exige uma duração).
const BAN_FOREVER = '876000h';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Senha temporária legível (sem 0/O, 1/l/I). */
function temporaryPassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Quem está chamando?
  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: callerData } = await callerClient.auth.getUser();
  const caller = callerData.user;
  if (!caller) return json(401, { error: 'Sessão inválida. Entre de novo no painel.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, disabled_at')
    .eq('id', caller.id)
    .maybeSingle();
  if (callerProfile?.role !== 'platform_admin' || callerProfile.disabled_at) {
    return json(403, { error: 'Somente a equipe da plataforma pode gerenciar usuários.' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Corpo da requisição inválido.' });
  }

  switch (body.action) {
    case 'create': {
      const email = String(body.email ?? '').trim().toLowerCase();
      const name = String(body.name ?? '').trim();
      const role = body.role as AdminRole;
      const tenantId = body.tenantId ? String(body.tenantId) : null;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'E-mail inválido.' });
      if (!ADMIN_ROLES.includes(role)) return json(400, { error: 'Papel inválido.' });
      if (role === 'tenant_admin' && !tenantId) {
        return json(400, { error: 'Administrador de franquia precisa de uma franquia.' });
      }

      const password = temporaryPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        // app_metadata só o servidor grava — é daqui que o trigger lê o papel.
        app_metadata: { role, tenant_id: role === 'platform_admin' ? null : tenantId },
        user_metadata: { name },
      });
      if (error) {
        const exists = error.message.toLowerCase().includes('already');
        return json(400, { error: exists ? 'Já existe uma conta com esse e-mail.' : error.message });
      }
      return json(200, { userId: data.user.id, temporaryPassword: password });
    }

    case 'reset_password': {
      const userId = String(body.userId ?? '');
      const password = temporaryPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json(400, { error: error.message });
      return json(200, { temporaryPassword: password });
    }

    case 'set_disabled': {
      const userId = String(body.userId ?? '');
      const disabled = Boolean(body.disabled);
      if (userId === caller.id) return json(400, { error: 'Você não pode bloquear a própria conta.' });

      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: disabled ? BAN_FOREVER : 'none',
      });
      if (error) return json(400, { error: error.message });

      const { error: profileError } = await admin
        .from('profiles')
        .update({ disabled_at: disabled ? new Date().toISOString() : null })
        .eq('id', userId);
      if (profileError) return json(400, { error: profileError.message });
      return json(200, { ok: true });
    }

    default:
      return json(400, { error: 'Ação desconhecida.' });
  }
});
