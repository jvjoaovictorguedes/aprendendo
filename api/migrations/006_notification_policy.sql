create table platform_notification_settings (
 id boolean primary key default true check(id),
 settings jsonb not null,
 updated_by uuid not null references users(id),
 updated_at timestamptz not null default now()
);
