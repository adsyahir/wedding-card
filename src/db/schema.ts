import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema for the wedding-card D1 database.
 *
 * Conventions used consistently across every table:
 * - Primary keys are application-generated UUID strings (`text`, defaulting to
 *   `crypto.randomUUID()`), never auto-increment integers.
 * - Every timestamp column uses `integer({ mode: "timestamp" })`, i.e. Drizzle
 *   stores/reads them as JS `Date` objects backed by a unix-seconds integer.
 * - Boolean flags use `integer({ mode: "boolean" })` (stored as 0/1).
 *
 * SECURITY: there is intentionally NO column anywhere in this schema that
 * stores a raw IP address or a raw user-agent string. `visitor_hash` (a
 * salted, truncated hash — see src/lib/crypto.ts) is the only per-visitor
 * identifier persisted. Do not add an `ip` or `user_agent` column, even for
 * debugging — that would defeat the anonymization this schema is designed
 * around.
 */

export const adminUsers = sqliteTable("admin_users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  iterations: integer("iterations").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp" }),
});

export const sessions = sqliteTable(
  "sessions",
  {
    // Stores the SHA-256 hex digest of the session token — NEVER the raw token.
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    csrfHash: text("csrf_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    idleExpiresAt: integer("idle_expires_at", { mode: "timestamp" }).notNull(),
    /*
     * How far `idleExpiresAt` slides forward each time the session is used.
     * Stored per session rather than read from a constant because "remember
     * me" sessions have a much longer idle window than ordinary ones — with
     * a single global constant, using a remembered session would shrink its
     * idle expiry back to the short window and log the admin out anyway.
     */
    // Defaulted so the migration can add the column to a table that already
    // has rows: SQLite refuses ADD COLUMN NOT NULL without one. The default
    // is the ordinary (non-remembered) window, which is the right value for
    // every session that existed before this column did.
    idleWindowSeconds: integer("idle_window_seconds").notNull().default(2 * 60 * 60),
    absoluteExpiresAt: integer("absolute_expires_at", {
      mode: "timestamp",
    }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (table) => [index("sessions_admin_user_id_idx").on(table.adminUserId)],
);

export const rsvps = sqliteTable(
  "rsvps",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    attending: integer("attending", { mode: "boolean" }).notNull(),
    adults: integer("adults").notNull(),
    children: integer("children").notNull().default(0),
    message: text("message"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    visitorHash: text("visitor_hash").notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    index("rsvps_created_at_idx").on(table.createdAt),
    index("rsvps_attending_idx").on(table.attending),
  ],
);

export const wishes = sqliteTable(
  "wishes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    message: text("message").notNull(),
    status: text("status")
      .$type<"pending" | "approved" | "rejected">()
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    moderatedAt: integer("moderated_at", { mode: "timestamp" }),
    moderatedBy: text("moderated_by"),
    visitorHash: text("visitor_hash").notNull(),
  },
  (table) => [index("wishes_status_created_at_idx").on(table.status, table.createdAt)],
);

export const pageViews = sqliteTable(
  "page_views",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
    path: text("path").notNull(),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    referrerHost: text("referrer_host"),
    deviceType: text("device_type"),
    os: text("os"),
    browser: text("browser"),
    visitorHash: text("visitor_hash").notNull(),
  },
  (table) => [
    index("page_views_ts_idx").on(table.ts),
    index("page_views_visitor_hash_idx").on(table.visitorHash),
  ],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
    name: text("name").notNull(),
    visitorHash: text("visitor_hash").notNull(),
    // JSON-encoded free-form metadata (string, parsed/serialized by callers).
    meta: text("meta"),
  },
  (table) => [index("events_name_ts_idx").on(table.name, table.ts)],
);

export const dailyStats = sqliteTable("daily_stats", {
  // YYYY-MM-DD
  day: text("day").primaryKey(),
  views: integer("views").notNull(),
  uniques: integer("uniques").notNull(),
  byCountry: text("by_country"),
  byReferrer: text("by_referrer"),
  byDevice: text("by_device"),
});

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start", { mode: "timestamp" }).notNull(),
  count: integer("count").notNull(),
});

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
    adminUserId: text("admin_user_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
  },
  (table) => [index("audit_log_ts_idx").on(table.ts)],
);

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  updatedBy: text("updated_by"),
});

export const musicTracks = sqliteTable("music_tracks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  label: text("label").notNull(),
  source: text("source").$type<"preset" | "upload">().notNull(),
  r2Key: text("r2_key"),
  storagePath: text("storage_path"),
  filename: text("filename"),
  mime: text("mime"),
  sizeBytes: integer("size_bytes"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull(),
  uploadedBy: text("uploaded_by"),
});

// No visitorHash, no IP — same rule as everywhere else in this schema (see
// the header comment above). These are admin-uploaded photos, not
// visitor-submitted content.
export const galleryImages = sqliteTable(
  "gallery_images",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    r2Key: text("r2_key").notNull(),
    filename: text("filename"),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    alt: text("alt").notNull(),
    sortOrder: integer("sort_order").notNull(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull(),
    uploadedBy: text("uploaded_by"),
  },
  (table) => [index("gallery_images_sort_order_idx").on(table.sortOrder)],
);
