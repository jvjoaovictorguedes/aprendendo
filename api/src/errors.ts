import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/** Erro com status HTTP e mensagem para mostrar ao usuário. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = 'Faça login para continuar.') => new HttpError(401, message);
export const forbidden = (message = 'Você não tem permissão para isso.') => new HttpError(403, message);
export const notFound = (message = 'Não encontrado.') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

// Mensagens para as violações de unicidade do schema.
const UNIQUE_MESSAGES: Record<string, string> = {
  users_admin_email_key: 'Já existe uma conta com esse e-mail.',
  users_tenant_cpf_key: 'Já existe um cliente com esse CPF nesta franquia.',
  tenants_slug_key: 'Já existe uma franquia com esse identificador (slug).',
  products_tenant_barcode_key: 'Já existe um produto com esse código de barras nesta franquia.',
  products_tenant_plu_key: 'Já existe um produto com esse PLU nesta franquia.',
};

type PgError = { code?: string; constraint?: string; message: string };

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | HttpError | ZodError | PgError, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const field = issue?.path.join('.');
      return reply.status(400).send({ error: field ? `${field}: ${issue.message}` : (issue?.message ?? 'Dados inválidos.') });
    }

    const pgError = error as PgError;
    if (pgError.code === '23505') {
      return reply
        .status(409)
        .send({ error: UNIQUE_MESSAGES[pgError.constraint ?? ''] ?? 'Já existe um registro com esse valor.' });
    }
    if (pgError.code === '23514' || pgError.code === '23502' || pgError.code === '22P02') {
      return reply.status(400).send({ error: 'Algum valor está fora do permitido. Confira os campos.' });
    }
    if (pgError.code === '23503') {
      return reply.status(400).send({ error: 'Registro relacionado não encontrado.' });
    }

    const fastifyError = error as FastifyError;
    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      return reply.status(fastifyError.statusCode).send({ error: fastifyError.message });
    }

    request.log.error(error);
    return reply.status(500).send({ error: 'Erro interno. Tente de novo em instantes.' });
  });

  app.setNotFoundHandler((_request, reply) => reply.status(404).send({ error: 'Rota não encontrada.' }));
}
