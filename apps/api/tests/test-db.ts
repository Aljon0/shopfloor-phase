import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

/** Rebuilds the schema from the migration files so every test run starts from a known state. */
export async function resetTestDatabase(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
    const sql = readFileSync(join(import.meta.dirname, '../prisma/migrations/20261113000000_init/migration.sql'), 'utf8')
    await client.query(sql)
  } finally {
    await client.end()
  }
}
