// supabase/tests/db/fixtures.ts
//
// Arrange helpers shared by the DB test files. Each goes through the same RPCs
// the app calls, as the acting student, so a fixture that works is itself a
// small proof that the happy path is permitted.
import { query, type TestDb, type TestUser } from './harness';

export async function createSpace(db: TestDb, owner: TestUser, name = 'Psych group 04'): Promise<string> {
  const [row] = await query<{ id: string }>(db, owner.id, `select public.create_space($1, 'class') as id`, [name]);
  return row.id;
}

export async function addMember(db: TestDb, spaceId: string, owner: TestUser, member: TestUser): Promise<void> {
  const [invite] = await query<{ code: string }>(
    db,
    owner.id,
    `select code from public.create_space_invite($1, 24, null)`,
    [spaceId]
  );
  await query(db, member.id, `select public.join_space_with_code($1)`, [invite.code]);
}

export async function roleOf(db: TestDb, spaceId: string, userId: string): Promise<string | null> {
  const rows = await db.admin<{ role: string }>(
    `select role from public.space_members where space_id = $1 and user_id = $2`,
    [spaceId, userId]
  );
  return rows[0]?.role ?? null;
}

/** A space with an owner and `count` extra members, all joined through a link. */
export async function spaceWith(
  db: TestDb,
  count: number,
  prefix = 'm'
): Promise<{ spaceId: string; owner: TestUser; members: TestUser[] }> {
  const owner = await db.createUser(`${prefix}_own`);
  const spaceId = await createSpace(db, owner, `${prefix} space`);
  const members: TestUser[] = [];
  for (let i = 0; i < count; i += 1) {
    const member = await db.createUser(`${prefix}_m`);
    await addMember(db, spaceId, owner, member);
    members.push(member);
  }
  return { spaceId, owner, members };
}

/** An ISO instant `days` from now at a fixed UTC hour, so tests never collide with "now". */
export function daysFromNow(days: number, utcHour = 15, minutes = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(utcHour, minutes, 0, 0);
  return date.toISOString();
}

export function plusMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}
