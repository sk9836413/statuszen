import type { Generated, Insertable, Selectable, Updateable } from "kysely";

/**
 * Database schema shared by the MySQL and SQLite drivers.
 *
 * Portability rules used across the project:
 * - booleans are stored as 0 / 1 integers
 * - timestamps are ISO-8601 strings (see `now()` in ./index.ts)
 * - money is stored in the smallest currency unit (cents)
 */

export interface SettingsTable {
  key: string;
  value: string | null;
}

export interface UsersTable {
  id: Generated<number>;
  name: string;
  email: string;
  password_hash: string;
  role: "user" | "admin";
  status: "active" | "banned";
  plan_id: number | null;
  plan_expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionsTable {
  id: string;
  user_id: number;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface PasswordResetsTable {
  token_hash: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface PlansTable {
  id: Generated<number>;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string | null;
  /** 0 = unlimited. */
  max_monitors: number;
  /** Shortest check interval allowed, in seconds. */
  min_interval_sec: number;
  /** 0 = unlimited. */
  max_status_pages: number;
  remove_branding: number;
  is_free: number;
  is_active: number;
  is_featured: number;
  sort_order: number;
  created_at: string;
}

export interface PaymentsTable {
  id: Generated<number>;
  user_id: number;
  plan_id: number;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  provider: "stripe" | "paypal" | "razorpay" | "offline";
  provider_ref: string;
  status: "pending" | "paid" | "rejected" | "refunded";
  note: string | null;
  created_at: string;
}

export interface PagesTable {
  id: Generated<number>;
  slug: string;
  title: string;
  content: string;
  meta_description: string | null;
  is_published: number;
  show_in_footer: number;
  created_at: string;
  updated_at: string;
}

export interface ContactMessagesTable {
  id: Generated<number>;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string | null;
  is_read: number;
  created_at: string;
}

export interface LanguagesTable {
  code: string;
  name: string;
  native_name: string;
  direction: "ltr" | "rtl";
  is_active: number;
  sort_order: number;
}

export interface TranslationsTable {
  lang: string;
  key: string;
  value: string;
}

export interface PostsTable {
  id: Generated<number>;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  meta_description: string | null;
  status: "draft" | "published";
  published_at: string | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface MonitorsTable {
  id: Generated<number>;
  user_id: number;
  name: string;
  /** See MonitorType in src/monitor/types.ts. */
  type: string;
  /** JSON: config for the monitor type (see src/monitor/types.ts). */
  config: string;
  interval_sec: number;
  /** Consecutive failures needed before the monitor is marked down. */
  confirm_count: number;
  status: "pending" | "up" | "down" | "paused" | "maintenance";
  is_active: number;
  /** Consecutive failed checks so far (resets on success). */
  fail_streak: number;
  last_check_at: string | null;
  next_check_at: string | null;
  last_change_at: string | null;
  last_response_ms: number | null;
  last_error: string | null;
  ssl_expires_at: string | null;
  domain_expires_at: string | null;
  /** Secret part of the heartbeat ping URL. */
  heartbeat_token: string;
  last_ping_at: string | null;
  /** When a "start" ping was received and no success/fail ping yet. */
  run_started_at: string | null;
  /** Last time a "still down" reminder was sent. */
  last_reminder_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChecksTable {
  id: Generated<number>;
  monitor_id: number;
  ok: number;
  status_code: number | null;
  response_ms: number | null;
  error: string | null;
  checked_at: string;
}

export interface MonitorDailyTable {
  monitor_id: number;
  day: string;
  checks: number;
  failures: number;
  total_ms: number;
  downtime_sec: number;
}

export interface IncidentsTable {
  id: Generated<number>;
  user_id: number;
  /** Set for incidents opened automatically by a monitor. */
  monitor_id: number | null;
  kind: "auto" | "manual" | "maintenance";
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved" | "scheduled" | "in_progress" | "completed";
  impact: "none" | "minor" | "major" | "critical" | "maintenance";
  started_at: string;
  resolved_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  /** JSON snapshot of the failing check (status, error, timing). */
  cause: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentUpdatesTable {
  id: Generated<number>;
  incident_id: number;
  status: IncidentsTable["status"];
  message: string;
  created_at: string;
}

export interface IncidentMonitorsTable {
  incident_id: number;
  monitor_id: number;
}

export interface AlertChannelsTable {
  id: Generated<number>;
  user_id: number;
  type: "email" | "webhook" | "slack" | "discord" | "telegram" | "teams";
  name: string;
  /** JSON: channel config (see src/monitor/types.ts). */
  config: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface MonitorChannelsTable {
  monitor_id: number;
  channel_id: number;
}

export interface AlertLogTable {
  id: Generated<number>;
  monitor_id: number | null;
  channel_id: number | null;
  event: string;
  ok: number;
  error: string | null;
  created_at: string;
}

export interface StatusPagesTable {
  id: Generated<number>;
  user_id: number;
  slug: string;
  name: string;
  description: string | null;
  logo: string | null;
  /** JSON: StatusPageSettings (see src/monitor/types.ts). */
  settings: string;
  is_public: number;
  created_at: string;
  updated_at: string;
}

export interface StatusPageMonitorsTable {
  page_id: number;
  monitor_id: number;
  group_name: string;
  display_name: string;
  sort_order: number;
}

export interface SubscribersTable {
  id: Generated<number>;
  page_id: number;
  email: string;
  token: string;
  confirmed_at: string | null;
  created_at: string;
}

export interface Database {
  settings: SettingsTable;
  users: UsersTable;
  sessions: SessionsTable;
  password_resets: PasswordResetsTable;
  plans: PlansTable;
  payments: PaymentsTable;
  pages: PagesTable;
  contact_messages: ContactMessagesTable;
  languages: LanguagesTable;
  translations: TranslationsTable;
  posts: PostsTable;
  monitors: MonitorsTable;
  checks: ChecksTable;
  monitor_daily: MonitorDailyTable;
  incidents: IncidentsTable;
  incident_updates: IncidentUpdatesTable;
  incident_monitors: IncidentMonitorsTable;
  alert_channels: AlertChannelsTable;
  monitor_channels: MonitorChannelsTable;
  alert_log: AlertLogTable;
  status_pages: StatusPagesTable;
  status_page_monitors: StatusPageMonitorsTable;
  subscribers: SubscribersTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
export type Plan = Selectable<PlansTable>;
export type Payment = Selectable<PaymentsTable>;
export type Page = Selectable<PagesTable>;
export type ContactMessage = Selectable<ContactMessagesTable>;
export type Language = Selectable<LanguagesTable>;
export type Post = Selectable<PostsTable>;
export type Monitor = Selectable<MonitorsTable>;
export type Check = Selectable<ChecksTable>;
export type Incident = Selectable<IncidentsTable>;
export type IncidentUpdate = Selectable<IncidentUpdatesTable>;
export type AlertChannel = Selectable<AlertChannelsTable>;
export type StatusPage = Selectable<StatusPagesTable>;
export type Subscriber = Selectable<SubscribersTable>;
