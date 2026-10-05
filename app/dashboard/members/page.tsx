import { MemberListProvider } from '@/context/MemberListContext'
import MembersViews from '@/components/MembersViews'
import MemberDetailModal from '@/components/modal/MemberDetailModal'
import ViewToggle from '@/components/ViewToggle'
import { getProfile, getUser } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'

import { ViewMode } from '@/components/ViewToggle'

interface PageProps {
  searchParams: Promise<{ view?: string; rootId?: string; avatar?: string }>
}
export default async function FamilyTreePage({ searchParams }: PageProps) {
  const { view, rootId, avatar } = await searchParams
  const initialView = view as ViewMode | undefined
  const initialShowAvatar = avatar !== 'hide'

  const user = await getUser()
  const profile = await getProfile()
  const canEdit =
    profile?.is_active === true &&
    (profile.role === 'admin' || profile.role === 'editor')

  const db = getDB()

  const [personsRes, relsRes] = await Promise.all([
    db.prepare('SELECT * FROM persons ORDER BY birth_year ASC NULLS LAST').all(),
    db.prepare('SELECT * FROM relationships').all()
  ])

  const rawPersons = personsRes.results ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relationships: any[] = relsRes.results ?? []

  // Guests see the tree without photos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persons: any[] = user
    ? rawPersons
    : rawPersons.map((p: Record<string, unknown>) => ({ ...p, avatar_url: null }))

  // Prepare map and roots for tree views
  const personsMap = new Map()
  persons.forEach((p: Record<string, unknown>) => personsMap.set(p.id, p))

  const childIds = new Set(
    (relationships as Array<{ type: string; person_b: string }>)
      .filter(
        (r) => r.type === 'biological_child' || r.type === 'adopted_child'
      )
      .map((r) => r.person_b)
  )

  let finalRootId = rootId

  if (!finalRootId || !personsMap.has(finalRootId)) {
    const rootsFallback = (persons as Array<{ id: string } & Record<string, unknown>>).filter((p) => !childIds.has(p.id))
    if (rootsFallback.length > 0) {
      finalRootId = rootsFallback[0].id
    } else if (persons.length > 0) {
      finalRootId = (persons[0] as { id: string }).id
    }
  }

  return (
    <MemberListProvider
      initialView={initialView}
      initialRootId={finalRootId}
      initialShowAvatar={initialShowAvatar}>
      <ViewToggle />
      <MembersViews
        persons={persons}
        relationships={relationships}
        canEdit={canEdit}
      />

      <MemberDetailModal />
    </MemberListProvider>
  )
}
