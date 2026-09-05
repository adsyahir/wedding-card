import "server-only";

import { and, asc, count, desc, eq, isNull, or, sql, sum } from "drizzle-orm";

import { getDb } from "@/db";
import { rsvps, wishes } from "@/db/schema";

/**
 * Read (and existence-check) queries backing the admin dashboard
 * (`/admin`, `/admin/rsvp`, `/admin/ucapan`).
 *
 * House style, mirroring `src/db/queries/public.ts`:
 * - Every query picks explicit columns — never `select *` into anything
 *   that reaches a component or a route handler's JSON response.
 * - `visitorHash` is NEVER selected here. The admin dashboard has no
 *   legitimate use for it, and it must never travel to the browser (see the
 *   schema-level comment in `src/db/schema.ts` about why it exists at all).
 * - Every row-shaped result is routed through a named `toX` mapper, so the
 *   "what's safe to expose" decision lives in one place per table, not
 *   scattered across call sites.
 *
 * Unlike `src/db/queries/public.ts`, these are NOT defensively wrapped in
 * try/catch with a zeroed fallback — an admin page failing loudly when D1 is
 * unreachable is the right behavior (there's no "degrade gracefully" story
 * for a dashboard the way there is for the public invite card).
 */

const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

/** Clamps `page`/`perPage` inputs (from URL search params) to sane bounds. */
export function resolvePagination(input: { page?: number; perPage?: number } = {}): {
  page: number;
  perPage: number;
} {
  const page =
    Number.isFinite(input.page) && (input.page as number) >= 1 ? Math.floor(input.page as number) : 1;

  const perPageRaw = Number.isFinite(input.perPage) ? Math.floor(input.perPage as number) : NaN;
  const perPage =
    Number.isFinite(perPageRaw) && perPageRaw >= 1
      ? Math.min(perPageRaw, MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;

  return { page, perPage };
}

export type RsvpSortField = "createdAt" | "name" | "adults";
export type SortDirection = "asc" | "desc";

const RSVP_SORT_FIELDS: readonly RsvpSortField[] = ["createdAt", "name", "adults"];
const SORT_DIRECTIONS: readonly SortDirection[] = ["asc", "desc"];

const DEFAULT_RSVP_SORT: { sort: RsvpSortField; direction: SortDirection } = {
  sort: "createdAt",
  direction: "desc",
};

/**
 * Whitelists a caller-supplied `sort`/`direction` pair down to one of the
 * known-safe combinations, falling back to the default for anything else —
 * including an empty string, `undefined`, or an arbitrary attacker-supplied
 * value. This is what stands between a URL query string and a query's
 * `ORDER BY` clause: nothing outside `RSVP_SORT_FIELDS` /
 * `SORT_DIRECTIONS` is ever interpolated into SQL.
 *
 * Pure and D1-free so it's unit-testable on its own (see
 * `src/db/queries/admin.test.ts`).
 */
export function resolveSort(input: {
  sort?: string;
  direction?: string;
}): { sort: RsvpSortField; direction: SortDirection } {
  const sort = RSVP_SORT_FIELDS.includes(input.sort as RsvpSortField)
    ? (input.sort as RsvpSortField)
    : DEFAULT_RSVP_SORT.sort;

  const direction = SORT_DIRECTIONS.includes(input.direction as SortDirection)
    ? (input.direction as SortDirection)
    : DEFAULT_RSVP_SORT.direction;

  return { sort, direction };
}

export type DashboardStats = {
  rsvpHadir: number;
  rsvpTidakHadir: number;
  totalDewasa: number;
  totalKanakKanak: number;
  totalPax: number;
  wishesPending: number;
  wishesApproved: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();

  const [[hadirRow], [tidakHadirRow], [sumsRow], [pendingRow], [approvedRow]] = await Promise.all([
    db
      .select({ n: count() })
      .from(rsvps)
      .where(and(isNull(rsvps.deletedAt), eq(rsvps.attending, true))),
    db
      .select({ n: count() })
      .from(rsvps)
      .where(and(isNull(rsvps.deletedAt), eq(rsvps.attending, false))),
    // Headcount totals only make sense over guests who ARE attending — a
    // "tidak hadir" row's adults/children count is not part of the catering
    // headcount.
    db
      .select({ adults: sum(rsvps.adults), children: sum(rsvps.children) })
      .from(rsvps)
      .where(and(isNull(rsvps.deletedAt), eq(rsvps.attending, true))),
    db.select({ n: count() }).from(wishes).where(eq(wishes.status, "pending")),
    db.select({ n: count() }).from(wishes).where(eq(wishes.status, "approved")),
  ]);

  // drizzle's `sum()` returns a string (SQLite has no fixed numeric type),
  // and `NULL` when there are zero matching rows.
  const totalDewasa = Number(sumsRow?.adults ?? 0);
  const totalKanakKanak = Number(sumsRow?.children ?? 0);

  return {
    rsvpHadir: hadirRow?.n ?? 0,
    rsvpTidakHadir: tidakHadirRow?.n ?? 0,
    totalDewasa,
    totalKanakKanak,
    totalPax: totalDewasa + totalKanakKanak,
    wishesPending: pendingRow?.n ?? 0,
    wishesApproved: approvedRow?.n ?? 0,
  };
}

export type RsvpRow = {
  id: string;
  name: string;
  phone: string;
  attending: boolean;
  adults: number;
  children: number;
  message: string | null;
  createdAt: string;
};

function toRsvpRow(row: {
  id: string;
  name: string;
  phone: string;
  attending: boolean;
  adults: number;
  children: number;
  message: string | null;
  createdAt: Date;
}): RsvpRow {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    attending: row.attending,
    adults: row.adults,
    children: row.children,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

const RSVP_LIST_COLUMNS = {
  id: rsvps.id,
  name: rsvps.name,
  phone: rsvps.phone,
  attending: rsvps.attending,
  adults: rsvps.adults,
  children: rsvps.children,
  message: rsvps.message,
  createdAt: rsvps.createdAt,
} as const;

/** Escapes SQLite LIKE wildcards so a search term is matched literally. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export type ListRsvpsInput = {
  search?: string;
  attending?: boolean;
  sort?: string;
  direction?: string;
  page?: number;
  perPage?: number;
};

export type ListRsvpsResult = {
  rows: RsvpRow[];
  total: number;
  page: number;
  perPage: number;
};

export async function listRsvps(input: ListRsvpsInput = {}): Promise<ListRsvpsResult> {
  const { sort, direction } = resolveSort(input);
  const { page, perPage } = resolvePagination(input);

  const db = getDb();

  const conditions = [isNull(rsvps.deletedAt)];

  if (input.attending !== undefined) {
    conditions.push(eq(rsvps.attending, input.attending));
  }

  const search = input.search?.trim();
  if (search) {
    // A parameterised, case-insensitive (SQLite's default LIKE behavior for
    // ASCII) substring match against name OR phone. `pattern` is bound as a
    // query parameter — never string-concatenated into the SQL text.
    const pattern = `%${escapeLikePattern(search)}%`;
    conditions.push(
      or(
        sql`${rsvps.name} LIKE ${pattern} ESCAPE '\\'`,
        sql`${rsvps.phone} LIKE ${pattern} ESCAPE '\\'`,
      )!,
    );
  }

  const where = and(...conditions);

  const sortColumn =
    sort === "name" ? rsvps.name : sort === "adults" ? rsvps.adults : rsvps.createdAt;
  const orderBy = direction === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [countRow] = await db.select({ n: count() }).from(rsvps).where(where);
  const total = countRow?.n ?? 0;

  const rows = await db
    .select(RSVP_LIST_COLUMNS)
    .from(rsvps)
    .where(where)
    .orderBy(orderBy)
    .limit(perPage)
    .offset((page - 1) * perPage);

  return { rows: rows.map(toRsvpRow), total, page, perPage };
}

/** Every non-deleted RSVP, explicit columns, for the CSV export. Unpaginated by design. */
export async function getAllRsvpsForExport(): Promise<RsvpRow[]> {
  const db = getDb();
  const rows = await db
    .select(RSVP_LIST_COLUMNS)
    .from(rsvps)
    .where(isNull(rsvps.deletedAt))
    .orderBy(desc(rsvps.createdAt));

  return rows.map(toRsvpRow);
}

/**
 * Existence check for the soft-delete route — looked up BEFORE the write so
 * a caller passing an id that doesn't exist (or is already deleted) gets a
 * 404 instead of a silently-successful no-op update.
 */
export async function findActiveRsvpById(id: string): Promise<{ id: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: rsvps.id })
    .from(rsvps)
    .where(and(eq(rsvps.id, id), isNull(rsvps.deletedAt)))
    .limit(1);
  return row ?? null;
}

export type WishStatus = "pending" | "approved" | "rejected";

export type WishRow = {
  id: string;
  name: string;
  message: string;
  status: WishStatus;
  createdAt: string;
  moderatedAt: string | null;
};

function toWishRow(row: {
  id: string;
  name: string;
  message: string;
  status: WishStatus;
  createdAt: Date;
  moderatedAt: Date | null;
}): WishRow {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    moderatedAt: row.moderatedAt ? row.moderatedAt.toISOString() : null,
  };
}

const WISH_LIST_COLUMNS = {
  id: wishes.id,
  name: wishes.name,
  message: wishes.message,
  status: wishes.status,
  createdAt: wishes.createdAt,
  moderatedAt: wishes.moderatedAt,
} as const;

export type ListWishesInput = {
  status?: WishStatus;
  page?: number;
  perPage?: number;
};

export type ListWishesResult = {
  rows: WishRow[];
  total: number;
  page: number;
  perPage: number;
};

export async function listWishes(input: ListWishesInput = {}): Promise<ListWishesResult> {
  const { page, perPage } = resolvePagination(input);
  const db = getDb();

  const where = input.status ? eq(wishes.status, input.status) : undefined;

  const [countRow] = await db.select({ n: count() }).from(wishes).where(where);
  const total = countRow?.n ?? 0;

  const rows = await db
    .select(WISH_LIST_COLUMNS)
    .from(wishes)
    .where(where)
    .orderBy(desc(wishes.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  return { rows: rows.map(toWishRow), total, page, perPage };
}

/** Up to `limit` pending wishes, oldest-queue-first, for the overview page's mini-queue. */
export async function listPendingWishesPreview(limit = 5): Promise<WishRow[]> {
  const db = getDb();
  const rows = await db
    .select(WISH_LIST_COLUMNS)
    .from(wishes)
    .where(eq(wishes.status, "pending"))
    .orderBy(desc(wishes.createdAt))
    .limit(limit);
  return rows.map(toWishRow);
}

export async function countPendingWishes(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ n: count() }).from(wishes).where(eq(wishes.status, "pending"));
  return row?.n ?? 0;
}

/**
 * Existence check for the moderate/delete routes — looked up BEFORE the
 * write for the same IDOR-guarding reason as `findActiveRsvpById`.
 */
export async function findWishById(id: string): Promise<{ id: string; status: WishStatus } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: wishes.id, status: wishes.status })
    .from(wishes)
    .where(eq(wishes.id, id))
    .limit(1);
  return row ?? null;
}
