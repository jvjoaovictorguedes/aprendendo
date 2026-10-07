// Sessões: cada login cria uma linha em "sessions" e devolve um JWT com o
// id dela. Em toda requisição o token é conferido E a sessão/usuário são
// relidos do banco — por isso bloquear usuário, redefinir senha ou sair
// valem na hora, sem esperar o token expirar.
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import jwt from 'jsonwebtoken';

import type { Db } from '../db/pool.js';
import { forbidden, unauthorized } from '../errors.js';

export type Role = 'platform_admin' | 'tenant_admin' | 'customer';

export type AuthUser = {
  id: string;
  sessionId: string;
  role: Role;
  tenantId: string | null;
  name: string;
  email: string | null;
  cpf: string | null;
  points: number;
  mustChangePassword: boolean;
};

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthUser | null;
  }
}

type TokenPayload = { sid: string; sub: string };

export async function createSession(
  db: Db,
  params: { userId: string; secret: string; days: number; userAgent?: string },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into sessions (user_id, expires_at, user_agent)
     values ($1, now() + make_interval(days => $2), $3)
     returning id`,
    [params.userId, params.days, params.userAgent?.slice(0, 300) ?? null],
  );
  await db.query('update users set last_login_at = now() where id = $1', [params.userId]);
  const payload: TokenPayload = { sid: rows[0].id, sub: params.userId };
  return jwt.sign(payload, params.secret, { expiresIn: `${params.days}d` });
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db.query('update sessions set revoked_at = now() where id = $1 and revoked_at is null', [sessionId]);
}

export async function revokeUserSessions(db: Db, userId: string, exceptSessionId?: string): Promise<void> {
  await db.query(
    `update sessions set revoked_at = now()
     where user_id = $1 and revoked_at is null and ($2::uuid is null or id <> $2::uuid)`,
    [userId, exceptSessionId ?? null],
  );
}

type UserRow = {
  id: string;
  role: Role;
  tenant_id: string | null;
  name: string;
  email: string | null;
  cpf: string | null;
  points: number;
  must_change_password: boolean;
};

async function resolveToken(db: Db, secret: string, header: string | undefined): Promise<AuthUser | null> {
  if (!header?.startsWith('Bearer ')) return null;
  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice('Bearer '.length), secret) as TokenPayload;
  } catch {
    return null;
  }

  const { rows } = await db.query<UserRow>(
    `select u.id, u.role, u.tenant_id, u.name, u.email, u.cpf, u.points, u.must_change_password
     from sessions s
     join users u on u.id = s.user_id
     where s.id = $1 and s.user_id = $2
       and s.revoked_at is null and s.expires_at > now()
       and u.disabled_at is null`,
    [payload.sid, payload.sub],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    sessionId: payload.sid,
    role: row.role,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email,
    cpf: row.cpf,
    points: row.points,
    mustChangePassword: row.must_change_password,
  };
}

/**
 * preHandler que exige login (e, se informado, um dos papéis).
 * Admin que entrou com senha temporária só usa as rotas de /auth (trocar
 * senha, /me, sair) até criar a própria senha — a senha temporária costuma ser
 * passada por mensagem e não pode virar acesso permanente ao painel.
 */
export function requireAuth(
  db: Db,
  secret: string,
  roles?: Role[],
  options: { allowPendingPasswordChange?: boolean } = {},
): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = await resolveToken(db, secret, request.headers.authorization);
    if (!user) throw unauthorized('Sessão expirada ou inválida. Entre de novo.');
    if (roles && !roles.includes(user.role)) throw forbidden();
    // Vale para o painel; o app do cliente ainda não tem tela de troca de senha.
    if (user.mustChangePassword && user.role !== 'customer' && !options.allowPendingPasswordChange) {
      throw forbidden('Crie sua senha antes de continuar (você entrou com uma senha temporária).');
    }
    request.auth = user;
  };
}

/** Garante que o usuário pode mexer nessa franquia. */
export function assertTenantAccess(user: AuthUser, tenantId: string): void {
  if (user.role === 'platform_admin') return;
  if (user.role === 'tenant_admin' && user.tenantId === tenantId) return;
  throw forbidden('Você só tem acesso à sua franquia.');
}
