import { z } from 'zod';
import type { Db } from './db/pool.js';
import type { Config } from './config.js';

export const notificationPolicySchema = z
  .object({
    enabled: z.boolean(),
    timezone: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('pt-BR', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Fuso horário inválido.'),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    cartReminderMinutes: z.number().int().min(1).max(1440),
    minimumIntervalMinutes: z.number().int().min(1).max(10080),
    minimumPurchases: z.number().int().min(1).max(50),
    purchaseWindowDays: z.number().int().min(1).max(365),
  })
  .strict()
  .refine(
    (v) => v.startHour !== v.endHour,
    'Use horários diferentes; 0 até 24 permite o dia inteiro.',
  );
export type NotificationPolicy = z.infer<typeof notificationPolicySchema>;
export function defaultNotificationPolicy(config: Config): NotificationPolicy {
  return {
    enabled: true,
    timezone: config.PUSH_TIMEZONE,
    startHour: 8,
    endHour: 22,
    cartReminderMinutes: config.CART_REMINDER_MINUTES,
    minimumIntervalMinutes: 1440,
    minimumPurchases: 3,
    purchaseWindowDays: 90,
  };
}
export async function loadNotificationPolicy(db: Db, config: Config): Promise<NotificationPolicy> {
  const row = (await db.query('select settings from platform_notification_settings where id=true'))
    .rows[0];
  return row ? notificationPolicySchema.parse(row.settings) : defaultNotificationPolicy(config);
}
