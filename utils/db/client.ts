import postgres from 'postgres'

export const databaseUrl = process.env.DATABASE_URL?.trim()

export const isDatabaseConfigured = Boolean(databaseUrl)

// Return dates and timestamps as strings, the same shape the app used to get
// from the Supabase REST API, so they serialize unchanged into client props.
const asString = {
  to: 25,
  from: [1082],
  serialize: (value: string) => value,
  parse: (value: string) => value
}

const asIsoString = {
  to: 1184,
  from: [1114, 1184],
  serialize: (value: string | Date) =>
    value instanceof Date ? value.toISOString() : value,
  parse: (value: string) => new Date(value).toISOString()
}

function createSql() {
  if (!databaseUrl) {
    throw new Error('Thiếu DATABASE_URL.')
  }

  return postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Neon's pooled endpoint runs PgBouncer in transaction mode.
    prepare: false,
    types: { date: asString, timestamp: asIsoString }
  })
}

const globalForSql = globalThis as unknown as {
  giaphaSql?: ReturnType<typeof createSql>
}

/** Shared connection pool, created on first use and reused across hot reloads. */
export function getSql() {
  globalForSql.giaphaSql ??= createSql()
  return globalForSql.giaphaSql
}

export type Sql = ReturnType<typeof getSql>
