'use server'

import { getServerTranslations } from '@/lib/i18n/server'
import type { TranslationKey, TranslationValues } from '@/lib/i18n/messages'
import { Relationship } from '@/types'
import { getIsAdmin } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import { generateId } from '@/utils/db/auth'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Payload shape cho file backup JSON.
 * Các field DB-managed (created_at, updated_at) được giữ để tham khảo
 * nhưng sẽ bị loại bỏ khi import lại.
 */
interface PersonExport {
  id: string
  full_name: string
  gender: 'male' | 'female' | 'other'
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  death_year: number | null
  death_month: number | null
  death_day: number | null
  death_lunar_year: number | null
  death_lunar_month: number | null
  death_lunar_day: number | null
  is_deceased: boolean
  is_in_law: boolean
  birth_order: number | null
  generation: number | null
  other_names: string | null
  dharma_name: string | null
  age_at_death: number | null
  avatar_url: string | null
  note: string | null
  // DB-managed fields (kept in export for traceability, stripped on import)
  created_at?: string
  updated_at?: string
}

interface RelationshipExport {
  id?: string
  type: string
  person_a: string
  person_b: string
  note?: string | null
  created_at?: string
  updated_at?: string
}

interface PersonDetailsPrivateExport {
  person_id: string
  phone_number: string | null
  occupation: string | null
  current_residence: string | null
}

interface CustomEventExport {
  id: string
  name: string
  content: string | null
  event_date: string
  location: string | null
  created_by: string | null
}

interface BackupPayload {
  version: number
  timestamp: string
  persons: PersonExport[]
  relationships: RelationshipExport[]
  person_details_private?: PersonDetailsPrivateExport[]
  custom_events?: CustomEventExport[]
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_PERSONS = 10000
const MAX_RELATIONSHIPS = 30000
const MAX_PRIVATE_DETAILS = 10000
const MAX_CUSTOM_EVENTS = 10000

function isShortText(value: unknown, maxLength: number) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.length <= maxLength)
  )
}

type Translator = (key: TranslationKey, values?: TranslationValues) => string

function validateImportPayload(input: unknown, t: Translator): string | null {
  if (!input || typeof input !== 'object') return t('invalidData')
  const payload = input as Record<string, unknown>
  const persons = payload.persons
  const relationships = payload.relationships

  if (!Array.isArray(persons) || !Array.isArray(relationships)) {
    return t('invalidDataStructure')
  }
  if (persons.length === 0) return t('emptyBackup')
  if (persons.length > MAX_PERSONS)
    return t('tooManyPersons', { count: MAX_PERSONS })
  if (relationships.length > MAX_RELATIONSHIPS)
    return t('tooManyRelationships', { count: MAX_RELATIONSHIPS })

  const personIds = new Set<string>()
  for (const person of persons) {
    if (!person || typeof person !== 'object') return t('invalidPersonRecord')
    const row = person as Record<string, unknown>
    if (typeof row.id !== 'string' || !UUID_PATTERN.test(row.id))
      return t('invalidPersonId')
    if (personIds.has(row.id)) return t('duplicatePersonId')
    personIds.add(row.id)
    if (
      typeof row.full_name !== 'string' ||
      row.full_name.trim().length === 0 ||
      row.full_name.length > 200
    ) {
      return t('invalidPersonName')
    }
    if (!['male', 'female', 'other'].includes(String(row.gender)))
      return t('invalidGender')
    for (const field of [
      'other_names',
      'dharma_name',
      'avatar_url',
      'note'
    ]) {
      if (!isShortText(row[field], 2000)) return t('fieldTooLong', { field })
    }
  }

  for (const relationship of relationships) {
    if (!relationship || typeof relationship !== 'object')
      return t('invalidRelationship')
    const row = relationship as Record<string, unknown>
    if (
      typeof row.person_a !== 'string' ||
      !personIds.has(row.person_a) ||
      typeof row.person_b !== 'string' ||
      !personIds.has(row.person_b) ||
      row.person_a === row.person_b ||
      !['marriage', 'biological_child', 'adopted_child'].includes(
        String(row.type)
      )
    )
      return t('invalidRelationshipData')
    if (!isShortText(row.note, 2000)) return t('relationshipNoteTooLong')
  }

  const privateDetails = payload.person_details_private
  if (privateDetails !== undefined) {
    if (
      !Array.isArray(privateDetails) ||
      privateDetails.length > MAX_PRIVATE_DETAILS
    ) {
      return t('privateDetailsLimit')
    }
    for (const detail of privateDetails) {
      if (!detail || typeof detail !== 'object')
        return t('invalidPrivateDetails')
      const row = detail as Record<string, unknown>
      if (typeof row.person_id !== 'string' || !personIds.has(row.person_id))
        return t('invalidPrivateDetailsPerson')
      for (const field of ['phone_number', 'occupation', 'current_residence']) {
        if (!isShortText(row[field], 500)) return t('fieldTooLong', { field })
      }
    }
  }

  const customEvents = payload.custom_events
  if (customEvents !== undefined) {
    if (
      !Array.isArray(customEvents) ||
      customEvents.length > MAX_CUSTOM_EVENTS
    ) {
      return t('eventsLimit')
    }
    for (const event of customEvents) {
      if (!event || typeof event !== 'object') return t('invalidEvent')
      const row = event as Record<string, unknown>
      if (typeof row.id !== 'string' || !UUID_PATTERN.test(row.id))
        return t('invalidEventId')
      if (
        typeof row.name !== 'string' ||
        row.name.trim().length === 0 ||
        row.name.length > 200
      )
        return t('invalidEventName')
      for (const field of ['content', 'location']) {
        if (!isShortText(row[field], 2000)) return t('fieldTooLong', { field })
      }
    }
  }
  return null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Các field được phép insert vào bảng persons (loại bỏ created_at/updated_at)
function sanitizePerson(
  p: PersonExport
): Omit<PersonExport, 'created_at' | 'updated_at'> {
  return {
    id: p.id,
    full_name: p.full_name,
    gender: p.gender,
    birth_year: p.birth_year ?? null,
    birth_month: p.birth_month ?? null,
    birth_day: p.birth_day ?? null,
    death_year: p.death_year ?? null,
    death_month: p.death_month ?? null,
    death_day: p.death_day ?? null,
    death_lunar_year: p.death_lunar_year ?? null,
    death_lunar_month: p.death_lunar_month ?? null,
    death_lunar_day: p.death_lunar_day ?? null,
    is_deceased: p.is_deceased ?? false,
    is_in_law: p.is_in_law ?? false,
    birth_order: p.birth_order ?? null,
    generation: p.generation ?? null,
    other_names: p.other_names ?? null,
    dharma_name: p.dharma_name ?? null,
    age_at_death: p.age_at_death ?? null,
    avatar_url: p.avatar_url ?? null,
    note: p.note ?? null
  }
}

function sanitizeRelationship(
  r: RelationshipExport
): Omit<RelationshipExport, 'id' | 'created_at' | 'updated_at'> {
  return {
    type: r.type,
    person_a: r.person_a,
    person_b: r.person_b,
    note: r.note ?? null
  }
}

function sanitizeCustomEvent(
  e: CustomEventExport
): Omit<CustomEventExport, 'created_by'> {
  return {
    id: e.id,
    name: e.name,
    content: e.content ?? null,
    event_date: e.event_date,
    location: e.location ?? null
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportData(
  exportRootId?: string
): Promise<BackupPayload | { error: string }> {
  const { t } = await getServerTranslations()
  const isAdmin = await getIsAdmin()
  if (!isAdmin) {
    return { error: t('dataAccessDenied') }
  }

  const db = getDB()

  let allPersons: PersonExport[] = []
  let allRels: RelationshipExport[] = []
  let allPrivateDetails: PersonDetailsPrivateExport[] = []
  let allCustomEvents: CustomEventExport[] = []

  try {
    const [personsRes, relsRes, privateRes, eventsRes] = await Promise.all([
      db.prepare('SELECT id, full_name, gender, birth_year, birth_month, birth_day, death_year, death_month, death_day, death_lunar_year, death_lunar_month, death_lunar_day, is_deceased, is_in_law, birth_order, generation, other_names, dharma_name, avatar_url, note, created_at, updated_at FROM persons ORDER BY created_at ASC').all<PersonExport>(),
      db.prepare('SELECT id, type, person_a, person_b, note, created_at, updated_at FROM relationships ORDER BY created_at ASC').all<RelationshipExport>(),
      db.prepare('SELECT person_id, phone_number, occupation, current_residence FROM person_details_private ORDER BY person_id ASC').all<PersonDetailsPrivateExport>(),
      db.prepare('SELECT id, name, content, event_date, location, created_by FROM custom_events ORDER BY event_date ASC').all<CustomEventExport>()
    ])
    // SQLite stores booleans as 0/1; coerce back to boolean for the export payload
    allPersons = (personsRes.results ?? []).map((p) => ({
      ...p,
      is_deceased: Boolean(p.is_deceased),
      is_in_law: Boolean(p.is_in_law)
    }))
    allRels = relsRes.results ?? []
    allPrivateDetails = privateRes.results ?? []
    allCustomEvents = eventsRes.results ?? []
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: t('loadDataError', { error: message }) }
  }

  let exportPersons = allPersons
  let exportRels = allRels
  let exportPrivateDetails = allPrivateDetails
  const exportCustomEvents = allCustomEvents

  // If a root person is selected, filter the export to only their subtree
  if (exportRootId && exportPersons.some((p) => p.id === exportRootId)) {
    const includedPersonIds = new Set<string>([exportRootId])

    // Pre-calculate adjacency lists for O(1) lookup to improve performance with large datasets
    const childrenMap = new Map<string, string[]>()
    const spouseMap = new Map<string, string[]>()

    exportRels.forEach((r) => {
      if (r.type === 'biological_child' || r.type === 'adopted_child') {
        if (!childrenMap.has(r.person_a)) childrenMap.set(r.person_a, [])
        childrenMap.get(r.person_a)!.push(r.person_b)
      } else if (r.type === 'marriage') {
        if (!spouseMap.has(r.person_a)) spouseMap.set(r.person_a, [])
        if (!spouseMap.has(r.person_b)) spouseMap.set(r.person_b, [])
        spouseMap.get(r.person_a)!.push(r.person_b)
        spouseMap.get(r.person_b)!.push(r.person_a)
      }
    })

    // 1. Traverse biological and adopted children recursively
    const findDescendants = (parentId: string) => {
      const children = childrenMap.get(parentId) || []
      children.forEach((childId) => {
        if (!includedPersonIds.has(childId)) {
          includedPersonIds.add(childId)
          findDescendants(childId)
        }
      })
    }
    findDescendants(exportRootId)

    // 2. Add spouses for everyone in the tree so far
    const descendantsArray = Array.from(includedPersonIds) // snapshot current members
    descendantsArray.forEach((personId) => {
      const spouses = spouseMap.get(personId) || []
      spouses.forEach((spouseId) => {
        includedPersonIds.add(spouseId)
      })
    })

    // 3. Filter the payload
    exportPersons = exportPersons.filter((p) => includedPersonIds.has(p.id))
    exportRels = exportRels.filter(
      (r) =>
        includedPersonIds.has(r.person_a) && includedPersonIds.has(r.person_b)
    )
    exportPrivateDetails = exportPrivateDetails.filter((d) =>
      includedPersonIds.has(d.person_id)
    )
    // custom_events are not person-scoped, so export all when subtree is selected
  }

  return {
    version: 3, // v3: adds death_lunar_*, person_details_private, relationship note, custom_events
    timestamp: new Date().toISOString(),
    persons: exportPersons,
    relationships: exportRels,
    person_details_private: exportPrivateDetails,
    custom_events: exportCustomEvents
  }
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importData(
  importPayload:
    | BackupPayload
    | {
        persons: PersonExport[]
        relationships: Relationship[]
        person_details_private?: PersonDetailsPrivateExport[]
        custom_events?: CustomEventExport[]
      }
) {
  const { t } = await getServerTranslations()
  const isAdmin = await getIsAdmin()
  if (!isAdmin) {
    return { error: t('dataAccessDenied') }
  }

  const db = getDB()

  const validationError = validateImportPayload(importPayload, t)
  if (validationError) return { error: validationError }

  try {
    // Clear all existing data respecting FK constraints
    await db.batch([
      db.prepare('DELETE FROM news_comments'),
      db.prepare('DELETE FROM news_posts'),
      db.prepare('DELETE FROM custom_events'),
      db.prepare('DELETE FROM relationships'),
      db.prepare('DELETE FROM person_details_private'),
      db.prepare('DELETE FROM persons')
    ])
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { error: t('deletePersonsError', { error: msg }) }
  }

  const now = new Date().toISOString()

  // Insert persons
  const persons = importPayload.persons.map(sanitizePerson)
  const CHUNK = 50 // D1 batch limit is lower than Supabase's
  try {
    for (let i = 0; i < persons.length; i += CHUNK) {
      const chunk = persons.slice(i, i + CHUNK)
      await db.batch(
        chunk.map((p) =>
          db
            .prepare(
              `INSERT OR REPLACE INTO persons
               (id, full_name, gender, birth_year, birth_month, birth_day,
                death_year, death_month, death_day, death_lunar_year,
                death_lunar_month, death_lunar_day, is_deceased, is_in_law,
                birth_order, generation, other_names, dharma_name, age_at_death,
                avatar_url, note, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
            )
            .bind(
              p.id, p.full_name, p.gender,
              p.birth_year, p.birth_month, p.birth_day,
              p.death_year, p.death_month, p.death_day,
              p.death_lunar_year, p.death_lunar_month, p.death_lunar_day,
              p.is_deceased ? 1 : 0, p.is_in_law ? 1 : 0,
              p.birth_order, p.generation,
              p.other_names, p.dharma_name, p.age_at_death,
              p.avatar_url, p.note, now, now
            )
        )
      )
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { error: t('importPersonsError', { chunk: 1, error: msg }) }
  }

  // Insert relationships
  const relationships = importPayload.relationships
    .filter((r) => r.person_a !== r.person_b)
    .map(sanitizeRelationship)

  try {
    for (let i = 0; i < relationships.length; i += CHUNK) {
      const chunk = relationships.slice(i, i + CHUNK)
      await db.batch(
        chunk.map((r) =>
          db
            .prepare(
              `INSERT OR IGNORE INTO relationships
               (id, type, person_a, person_b, note, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?)`
            )
            .bind(generateId(), r.type, r.person_a, r.person_b, r.note, now, now)
        )
      )
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { error: t('importRelationshipsError', { chunk: 1, error: msg }) }
  }

  // Insert private details
  const privateDetails = importPayload.person_details_private ?? []
  if (privateDetails.length > 0) {
    try {
      for (let i = 0; i < privateDetails.length; i += CHUNK) {
        const chunk = privateDetails.slice(i, i + CHUNK)
        await db.batch(
          chunk.map((d) =>
            db
              .prepare(
                'INSERT OR REPLACE INTO person_details_private (person_id, phone_number, occupation, current_residence) VALUES (?,?,?,?)'
              )
              .bind(d.person_id, d.phone_number, d.occupation, d.current_residence)
          )
        )
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { error: t('importPrivateDetailsError', { chunk: 1, error: msg }) }
    }
  }

  // Insert custom events
  const customEvents = (importPayload.custom_events ?? []).map(sanitizeCustomEvent)
  if (customEvents.length > 0) {
    try {
      for (let i = 0; i < customEvents.length; i += CHUNK) {
        const chunk = customEvents.slice(i, i + CHUNK)
        await db.batch(
          chunk.map((e) =>
            db
              .prepare(
                'INSERT OR REPLACE INTO custom_events (id, name, content, event_date, location) VALUES (?,?,?,?,?)'
              )
              .bind(e.id, e.name, e.content, e.event_date, e.location)
          )
        )
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { error: t('importEventsError', { chunk: 1, error: msg }) }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/members')
  revalidatePath('/dashboard/data')

  return {
    success: true,
    imported: {
      persons: persons.length,
      relationships: relationships.length,
      person_details_private: privateDetails.length,
      custom_events: customEvents.length
    }
  }
}
