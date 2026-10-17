import "server-only";
import { sql, type Kysely } from "kysely";
import type { Migration, MigrationProvider } from "kysely/migration";
import { DEFAULT_PAGES } from "./seed-pages";
import { DEFAULT_POSTS } from "./seed-posts";

/**
 * Versioned schema migrations. They run automatically on first database
 * access after an update, so buyers only need to replace files and restart.
 * Never edit a released migration: add a new one instead.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = Kysely<any>;

const ts = () => new Date().toISOString();

const migrations: Record<string, Migration> = {
  "2026_10_16_000001_initial_schema": {
    async up(db: AnyDb) {
      await db.schema
        .createTable("settings")
        .addColumn("key", "varchar(100)", (c) => c.primaryKey())
        .addColumn("value", "text")
        .execute();

      await db.schema
        .createTable("users")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("email", "varchar(190)", (c) => c.notNull().unique())
        .addColumn("password_hash", "varchar(255)", (c) => c.notNull())
        .addColumn("role", "varchar(20)", (c) => c.notNull().defaultTo("user"))
        .addColumn("status", "varchar(20)", (c) => c.notNull().defaultTo("active"))
        .addColumn("plan_id", "integer")
        .addColumn("plan_expires_at", "varchar(32)")
        .addColumn("stripe_customer_id", "varchar(100)")
        .addColumn("stripe_subscription_id", "varchar(100)")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("sessions")
        .addColumn("id", "varchar(64)", (c) => c.primaryKey())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("expires_at", "varchar(32)", (c) => c.notNull())
        .addColumn("ip", "varchar(64)")
        .addColumn("user_agent", "varchar(255)")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("sessions_user_id_idx").on("sessions").column("user_id").execute();

      await db.schema
        .createTable("password_resets")
        .addColumn("token_hash", "varchar(64)", (c) => c.primaryKey())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("expires_at", "varchar(32)", (c) => c.notNull())
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("plans")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "varchar(100)", (c) => c.notNull())
        .addColumn("description", "varchar(255)")
        .addColumn("price_monthly", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("price_yearly", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("features", "text")
        // 0 means unlimited for the three limits below.
        .addColumn("max_monitors", "integer", (c) => c.notNull().defaultTo(5))
        .addColumn("min_interval_sec", "integer", (c) => c.notNull().defaultTo(300))
        .addColumn("max_status_pages", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("remove_branding", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("is_free", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("is_featured", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("payments")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("plan_id", "integer", (c) => c.notNull())
        .addColumn("amount", "integer", (c) => c.notNull())
        .addColumn("currency", "varchar(10)", (c) => c.notNull())
        .addColumn("billing_cycle", "varchar(10)", (c) => c.notNull())
        .addColumn("provider", "varchar(20)", (c) => c.notNull())
        .addColumn("provider_ref", "varchar(190)", (c) => c.notNull().unique())
        .addColumn("status", "varchar(20)", (c) => c.notNull())
        .addColumn("note", "text")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("payments_user_id_idx").on("payments").column("user_id").execute();

      await db.schema
        .createTable("pages")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("slug", "varchar(120)", (c) => c.notNull().unique())
        .addColumn("title", "varchar(255)", (c) => c.notNull())
        .addColumn("content", "text", (c) => c.notNull())
        .addColumn("meta_description", "varchar(255)")
        .addColumn("is_published", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("show_in_footer", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("contact_messages")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("email", "varchar(190)", (c) => c.notNull())
        .addColumn("subject", "varchar(255)", (c) => c.notNull())
        .addColumn("message", "text", (c) => c.notNull())
        .addColumn("ip", "varchar(64)")
        .addColumn("is_read", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema
        .createTable("languages")
        .addColumn("code", "varchar(12)", (c) => c.primaryKey())
        .addColumn("name", "varchar(60)", (c) => c.notNull())
        .addColumn("native_name", "varchar(60)", (c) => c.notNull())
        .addColumn("direction", "varchar(3)", (c) => c.notNull().defaultTo("ltr"))
        .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
        .execute();

      await db.schema
        .createTable("translations")
        .addColumn("lang", "varchar(12)", (c) => c.notNull())
        .addColumn("key", "varchar(190)", (c) => c.notNull())
        .addColumn("value", "text", (c) => c.notNull())
        .addPrimaryKeyConstraint("translations_pk", ["lang", "key"])
        .execute();

      await db.schema
        .createTable("posts")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("slug", "varchar(160)", (c) => c.notNull().unique())
        .addColumn("title", "varchar(255)", (c) => c.notNull())
        .addColumn("excerpt", "varchar(500)")
        .addColumn("content", "text", (c) => c.notNull())
        .addColumn("cover_image", "varchar(500)")
        .addColumn("meta_description", "varchar(255)")
        .addColumn("status", "varchar(12)", (c) => c.notNull().defaultTo("draft"))
        .addColumn("published_at", "varchar(32)")
        .addColumn("views", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("posts_status_published_idx").on("posts").columns(["status", "published_at"]).execute();

      // ── Monitoring ──
      await db.schema
        .createTable("monitors")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("type", "varchar(20)", (c) => c.notNull())
        .addColumn("config", "text", (c) => c.notNull())
        .addColumn("interval_sec", "integer", (c) => c.notNull().defaultTo(300))
        .addColumn("confirm_count", "integer", (c) => c.notNull().defaultTo(2))
        .addColumn("status", "varchar(12)", (c) => c.notNull().defaultTo("pending"))
        .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("fail_streak", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("last_check_at", "varchar(32)")
        .addColumn("next_check_at", "varchar(32)")
        .addColumn("last_change_at", "varchar(32)")
        .addColumn("last_response_ms", "integer")
        .addColumn("last_error", "varchar(500)")
        .addColumn("ssl_expires_at", "varchar(32)")
        .addColumn("domain_expires_at", "varchar(32)")
        .addColumn("heartbeat_token", "varchar(40)", (c) => c.notNull().unique())
        .addColumn("last_ping_at", "varchar(32)")
        .addColumn("run_started_at", "varchar(32)")
        .addColumn("last_reminder_at", "varchar(32)")
        .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("monitors_user_idx").on("monitors").column("user_id").execute();
      await db.schema.createIndex("monitors_due_idx").on("monitors").columns(["is_active", "next_check_at"]).execute();

      await db.schema
        .createTable("checks")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("monitor_id", "integer", (c) => c.notNull())
        .addColumn("ok", "integer", (c) => c.notNull())
        .addColumn("status_code", "integer")
        .addColumn("response_ms", "integer")
        .addColumn("error", "varchar(500)")
        .addColumn("checked_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("checks_monitor_time_idx").on("checks").columns(["monitor_id", "checked_at"]).execute();

      await db.schema
        .createTable("monitor_daily")
        .addColumn("monitor_id", "integer", (c) => c.notNull())
        .addColumn("day", "varchar(10)", (c) => c.notNull())
        .addColumn("checks", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("failures", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("total_ms", "bigint", (c) => c.notNull().defaultTo(0))
        .addColumn("downtime_sec", "integer", (c) => c.notNull().defaultTo(0))
        .addPrimaryKeyConstraint("monitor_daily_pk", ["monitor_id", "day"])
        .execute();

      await db.schema
        .createTable("incidents")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("monitor_id", "integer")
        .addColumn("kind", "varchar(12)", (c) => c.notNull())
        .addColumn("title", "varchar(200)", (c) => c.notNull())
        .addColumn("status", "varchar(16)", (c) => c.notNull())
        .addColumn("impact", "varchar(12)", (c) => c.notNull().defaultTo("major"))
        .addColumn("started_at", "varchar(32)", (c) => c.notNull())
        .addColumn("resolved_at", "varchar(32)")
        .addColumn("scheduled_start", "varchar(32)")
        .addColumn("scheduled_end", "varchar(32)")
        .addColumn("cause", "text")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("incidents_user_idx").on("incidents").columns(["user_id", "started_at"]).execute();
      await db.schema.createIndex("incidents_monitor_idx").on("incidents").columns(["monitor_id", "resolved_at"]).execute();

      await db.schema
        .createTable("incident_updates")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("incident_id", "integer", (c) => c.notNull())
        .addColumn("status", "varchar(16)", (c) => c.notNull())
        .addColumn("message", "text", (c) => c.notNull())
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("incident_updates_incident_idx").on("incident_updates").column("incident_id").execute();

      await db.schema
        .createTable("incident_monitors")
        .addColumn("incident_id", "integer", (c) => c.notNull())
        .addColumn("monitor_id", "integer", (c) => c.notNull())
        .addPrimaryKeyConstraint("incident_monitors_pk", ["incident_id", "monitor_id"])
        .execute();

      await db.schema
        .createTable("alert_channels")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("type", "varchar(12)", (c) => c.notNull())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("config", "text", (c) => c.notNull())
        .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("alert_channels_user_idx").on("alert_channels").column("user_id").execute();

      await db.schema
        .createTable("monitor_channels")
        .addColumn("monitor_id", "integer", (c) => c.notNull())
        .addColumn("channel_id", "integer", (c) => c.notNull())
        .addPrimaryKeyConstraint("monitor_channels_pk", ["monitor_id", "channel_id"])
        .execute();

      await db.schema
        .createTable("alert_log")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("monitor_id", "integer")
        .addColumn("channel_id", "integer")
        .addColumn("event", "varchar(30)", (c) => c.notNull())
        .addColumn("ok", "integer", (c) => c.notNull())
        .addColumn("error", "varchar(500)")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("alert_log_monitor_idx").on("alert_log").columns(["monitor_id", "created_at"]).execute();

      await db.schema
        .createTable("status_pages")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("slug", "varchar(60)", (c) => c.notNull().unique())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("description", "varchar(500)")
        .addColumn("logo", "varchar(500)")
        .addColumn("settings", "text", (c) => c.notNull())
        .addColumn("is_public", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("status_pages_user_idx").on("status_pages").column("user_id").execute();

      await db.schema
        .createTable("status_page_monitors")
        .addColumn("page_id", "integer", (c) => c.notNull())
        .addColumn("monitor_id", "integer", (c) => c.notNull())
        .addColumn("group_name", "varchar(80)", (c) => c.notNull().defaultTo(""))
        .addColumn("display_name", "varchar(120)", (c) => c.notNull().defaultTo(""))
        .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
        .addPrimaryKeyConstraint("status_page_monitors_pk", ["page_id", "monitor_id"])
        .execute();

      await db.schema
        .createTable("subscribers")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("page_id", "integer", (c) => c.notNull())
        .addColumn("email", "varchar(190)", (c) => c.notNull())
        .addColumn("token", "varchar(48)", (c) => c.notNull().unique())
        .addColumn("confirmed_at", "varchar(32)")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("subscribers_page_idx").on("subscribers").column("page_id").execute();
    },
    async down(db: AnyDb) {
      for (const table of [
        "subscribers",
        "status_page_monitors",
        "status_pages",
        "alert_log",
        "monitor_channels",
        "alert_channels",
        "incident_monitors",
        "incident_updates",
        "incidents",
        "monitor_daily",
        "checks",
        "monitors",
        "posts",
        "translations",
        "languages",
        "contact_messages",
        "pages",
        "payments",
        "plans",
        "password_resets",
        "sessions",
        "users",
        "settings",
      ]) {
        await db.schema.dropTable(table).ifExists().execute();
      }
    },
  },

  "2026_10_16_000002_seed_defaults": {
    async up(db: AnyDb) {
      const now = ts();
      await db
        .insertInto("plans")
        .values([
          {
            name: "Free",
            description: "Monitor your most important website.",
            price_monthly: 0,
            price_yearly: 0,
            features: ["5 monitors", "Checks every 5 minutes", "1 status page", "All monitor types and alert channels", "90-day uptime history"].join("\n"),
            max_monitors: 5,
            min_interval_sec: 300,
            max_status_pages: 1,
            remove_branding: 0,
            is_free: 1,
            is_active: 1,
            is_featured: 0,
            sort_order: 1,
            created_at: now,
          },
          {
            name: "Pro",
            description: "For businesses that can't afford downtime.",
            price_monthly: 1500,
            price_yearly: 15000,
            features: ["50 monitors", "Checks every minute", "5 status pages", "No branding on status pages", "Priority support"].join("\n"),
            max_monitors: 50,
            min_interval_sec: 60,
            max_status_pages: 5,
            remove_branding: 1,
            is_free: 0,
            is_active: 1,
            is_featured: 1,
            sort_order: 2,
            created_at: now,
          },
          {
            name: "Agency",
            description: "For agencies and teams monitoring many clients.",
            price_monthly: 3900,
            price_yearly: 39000,
            features: ["500 monitors", "Checks every 30 seconds", "50 status pages", "No branding on status pages", "Priority support"].join("\n"),
            max_monitors: 500,
            min_interval_sec: 30,
            max_status_pages: 50,
            remove_branding: 1,
            is_free: 0,
            is_active: 1,
            is_featured: 0,
            sort_order: 3,
            created_at: now,
          },
        ])
        .execute();

      await db
        .insertInto("pages")
        .values(
          DEFAULT_PAGES.map((p) => ({
            slug: p.slug,
            title: p.title,
            content: p.content,
            meta_description: p.metaDescription,
            is_published: 1,
            show_in_footer: 1,
            created_at: now,
            updated_at: now,
          })),
        )
        .execute();

      await db.insertInto("languages").values({ code: "en", name: "English", native_name: "English", direction: "ltr", is_active: 1, sort_order: 0 }).execute();
      await db
        .insertInto("posts")
        .values(
          DEFAULT_POSTS.map((p, i) => ({
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            content: p.content,
            cover_image: null,
            meta_description: p.metaDescription,
            status: "published",
            published_at: new Date(Date.now() - (DEFAULT_POSTS.length - i) * 86_400_000).toISOString(),
            views: 0,
            created_at: now,
            updated_at: now,
          })),
        )
        .execute();
    },
    async down(db: AnyDb) {
      for (const table of ["posts", "languages", "pages", "plans"]) await sql`DELETE FROM ${sql.table(table)}`.execute(db);
    },
  },
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
