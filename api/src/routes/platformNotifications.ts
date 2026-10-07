import type { FastifyInstance } from 'fastify';
import type { Deps } from '../app.js';
import { requireAuth } from '../auth/session.js';
import {
  defaultNotificationPolicy,
  loadNotificationPolicy,
  notificationPolicySchema,
} from '../notificationPolicy.js';

export async function platformNotificationRoutes(app: FastifyInstance, { db, config }: Deps) {
  const platform = requireAuth(db, config.JWT_SECRET, ['platform_admin']);
  app.get('/admin/notification-settings', { preHandler: platform }, async () => ({
    settings: await loadNotificationPolicy(db, config),
    defaults: defaultNotificationPolicy(config),
    serverPushEnabled: config.PUSH_ENABLED,
  }));
  app.put('/admin/notification-settings', { preHandler: platform }, async (request) => {
    const settings = notificationPolicySchema.parse(request.body);
    await db.query(
      `insert into platform_notification_settings(id,settings,updated_by) values(true,$1::jsonb,$2)
      on conflict(id) do update set settings=excluded.settings,updated_by=excluded.updated_by,updated_at=now()`,
      [JSON.stringify(settings), request.auth!.id],
    );
    return {
      settings,
      defaults: defaultNotificationPolicy(config),
      serverPushEnabled: config.PUSH_ENABLED,
    };
  });
}
