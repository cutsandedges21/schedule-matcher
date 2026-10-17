// supabase/tests/db/harness.ts
//
// Runs every migration against a real Postgres (PGlite: Postgres compiled to
// WASM, in-process, no Docker) so row-level security and the RPCs can be
// tested the way Supabase will run them — as the `authenticated` role, with a
// JWT's `sub` claim behind auth.uid().
//
// The shim below stands in for what a Supabase project provides before any
// migration runs: the anon/authenticated/service_role roles, an `auth` schema
// with `users` and `uid()`, and Supabase's default grants (every role gets ALL
// on new public tables and EXECUTE on new functions, and RLS is what actually
// restricts them). Get those defaults wrong and a missing policy would pass
// here and fail in production, so they mirror the real ones rather than being
// convenient.
//
// What this cannot prove: concurrency. PGlite is one connection, so two
// transactions never interleave. Row locks and advisory locks are exercised
// for correctness of the happy path only.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

const SUPABASE_SHIM = `
  -- Supabase sessions run in UTC. PGlite otherwise picks up whatever the
  -- host machine uses, and any SQL that leans on the session zone by mistake
  -- would pass here and fail in production, or the other way round.
  set timezone to 'UTC';

  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;

  create table auth.users (
    id          uuid primary key,
    instance_id uuid,
    aud         text,
    role        text,
    email       text,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
  );

  create function auth.uid() returns uuid
  language sql stable
  as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
  $$;

  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export type Row = Record<string, unknown>;
export type Sql = <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]>;

export interface TestUser {
  id: string;
  username: string;
}

export interface TestDb {
  /** Superuser: bypasses RLS. For arranging state and inspecting it. */
  admin: Sql;
  /**
   * Runs `work` in one transaction as a signed-in student (or as `anon` when
   * userId is null). Rolled back if `work` throws, so a failed statement
   * cannot poison the next call.
   */
  as: <T>(userId: string | null, work: (sql: Sql) => Promise<T>) => Promise<T>;
  createUser: (prefix?: string) => Promise<TestUser>;
  close: () => Promise<void>;
}

let userCounter = 0;

export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_SHIM);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    try {
      await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }

  const admin: Sql = async (text, params) => (await pg.query(text, params)).rows as never;

  const as: TestDb['as'] = (userId, work) =>
    pg.transaction(async (tx) => {
      const claims = userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' };
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`);
      const sql: Sql = async (text, params) => (await tx.query(text, params)).rows as never;
      return work(sql);
    });

  async function createUser(prefix = 'user'): Promise<TestUser> {
    userCounter += 1;
    const username = `${prefix}_${userCounter}`.slice(0, 20);
    const [{ id }] = await admin<{ id: string }>(
      `insert into auth.users (id, email, aud, role)
       values (gen_random_uuid(), $1, 'authenticated', 'authenticated')
       returning id`,
      [`${username}@example.test`]
    );
    await admin(`insert into public.profiles (id, username) values ($1, $2)`, [id, username]);
    return { id, username };
  }

  return { admin, as, createUser, close: () => pg.close() };
}

/** Shorthand for the one-statement-as-a-user case. */
export function query<T extends Row = Row>(
  db: TestDb,
  userId: string | null,
  text: string,
  params?: unknown[]
): Promise<T[]> {
  return db.as(userId, (sql) => sql<T>(text, params));
}
