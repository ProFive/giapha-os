import { Person, Relationship } from '@/types'

export interface SpouseData {
  person: Person
  note?: string | null
}

export interface AdjacencyLists {
  spousesByPersonId: Map<string, SpouseData[]>
  childrenByPersonId: Map<string, Person[]>
}

export interface TreeFilterOptions {
  hideDaughtersInLaw: boolean
  hideSonsInLaw: boolean
  hideDaughters: boolean
  hideSons: boolean
  hideMales: boolean
  hideFemales: boolean
}

/**
 * Xây dựng danh sách kề (adjacency lists) cho vợ/chồng và con cái từ dữ liệu thô.
 * Giúp tối ưu truy vấn từ O(N) xuống O(1).
 */
export function buildAdjacencyLists(
  relationships: Relationship[],
  personsMap: Map<string, Person>
): AdjacencyLists {
  const spouses = new Map<string, SpouseData[]>()
  const children = new Map<string, Person[]>()

  relationships.forEach((r) => {
    if (r.type === 'marriage') {
      if (!spouses.has(r.person_a)) spouses.set(r.person_a, [])
      if (!spouses.has(r.person_b)) spouses.set(r.person_b, [])

      const pB = personsMap.get(r.person_b)
      if (pB) spouses.get(r.person_a)!.push({ person: pB, note: r.note })

      const pA = personsMap.get(r.person_a)
      if (pA) spouses.get(r.person_b)!.push({ person: pA, note: r.note })
    } else if (r.type === 'biological_child' || r.type === 'adopted_child') {
      if (!children.has(r.person_a)) children.set(r.person_a, [])
      const child = personsMap.get(r.person_b)
      if (child) children.get(r.person_a)!.push(child)
    }
  })

  // Sắp xếp con cái theo thứ tự sinh hoặc năm sinh
  children.forEach((childArray) => {
    childArray.sort((a, b) => {
      const aOrder = a.birth_order ?? Infinity
      const bOrder = b.birth_order ?? Infinity
      if (aOrder !== bOrder) return aOrder - bOrder
      const aYear = a.birth_year ?? Infinity
      const bYear = b.birth_year ?? Infinity
      return aYear - bYear
    })
  })

  return { spousesByPersonId: spouses, childrenByPersonId: children }
}

/**
 * Lấy dữ liệu của một node trong cây (vợ chồng, con cái) đã qua bộ lọc.
 */
export function getFilteredTreeData(
  personId: string,
  personsMap: Map<string, Person>,
  adj: AdjacencyLists,
  filters: TreeFilterOptions
) {
  const {
    hideDaughtersInLaw,
    hideSonsInLaw,
    hideDaughters,
    hideSons,
    hideMales,
    hideFemales
  } = filters

  let spousesList = adj.spousesByPersonId.get(personId) || []
  spousesList = spousesList.filter((s) => {
    if (hideDaughtersInLaw && s.person.gender === 'female') return false
    if (hideSonsInLaw && s.person.gender === 'male') return false
    if (hideMales && s.person.gender === 'male') return false
    if (hideFemales && s.person.gender === 'female') return false
    return true
  })

  let childrenList = adj.childrenByPersonId.get(personId) || []
  childrenList = childrenList.filter((c) => {
    if (hideDaughters && c.gender === 'female') return false
    if (hideSons && c.gender === 'male') return false
    if (hideMales && c.gender === 'male') return false
    if (hideFemales && c.gender === 'female') return false
    return true
  })

  return {
    person: personsMap.get(personId)!,
    spouses: spousesList,
    children: childrenList
  }
}

export interface PrayerForPeaceOptions {
  /** "Nhà thờ lớn": lấy thêm gia đình anh/chị/em cùng cha với gia chủ. */
  includeFatherSiblings?: boolean
}

/** Tìm người cha (parent có gender male) của một người. */
function findFather(
  personId: string,
  personsMap: Map<string, Person>,
  relationships: Relationship[]
): Person | null {
  for (const r of relationships) {
    if (r.type !== 'biological_child' && r.type !== 'adopted_child') continue
    if (r.person_b !== personId) continue
    const parent = personsMap.get(r.person_a)
    if (parent?.gender === 'male') return parent
  }
  return null
}

/**
 * Danh sách cầu an: gia chủ và toàn bộ con cháu còn sống, kèm vợ/chồng và dâu/rể.
 * Vợ/chồng của gia chủ đứng ngay sau gia chủ, sau đó duyệt theo từng đời,
 * mỗi người con đứng ngay trước vợ/chồng của họ.
 * Người đã mất vẫn được duyệt qua để không bỏ sót con cháu của họ,
 * nhưng bị loại khỏi kết quả cuối cùng.
 *
 * Với tuỳ chọn "nhà thờ lớn", anh/chị/em cùng cha của gia chủ (kể cả cùng cha
 * khác mẹ) được gộp chung vào đời của gia chủ, con cháu của họ nhập chung
 * vào các đời phía dưới. Bản thân người cha không được liệt kê.
 */
export function buildPrayerForPeaceList(
  rootId: string,
  persons: Person[],
  relationships: Relationship[],
  options: PrayerForPeaceOptions = {}
): Person[] {
  const personsMap = new Map(persons.map((p) => [p.id, p]))
  const root = personsMap.get(rootId)
  if (!root) return []

  const adj = buildAdjacencyLists(relationships, personsMap)

  // Gia chủ đứng đầu, sau đó tới anh/chị/em cùng cha theo thứ tự sinh.
  const roots: Person[] = [root]
  if (options.includeFatherSiblings) {
    const father = findFather(rootId, personsMap, relationships)
    if (father) {
      const siblings = adj.childrenByPersonId.get(father.id) || []
      siblings.forEach((sibling) => {
        if (sibling.id !== rootId) roots.push(sibling)
      })
    }
  }

  const result: Person[] = []
  const seen = new Set<string>()

  // Mỗi người ở đời gia chủ đứng ngay trước vợ/chồng của mình.
  roots.forEach((person) => {
    if (seen.has(person.id)) return
    seen.add(person.id)
    result.push(person)

    const spouses = adj.spousesByPersonId.get(person.id) || []
    spouses.forEach(({ person: spouse }) => {
      if (seen.has(spouse.id)) return
      seen.add(spouse.id)
      result.push(spouse)
    })
  })

  // Chỉ đi tiếp theo huyết thống để không kéo theo con riêng của dâu/rể.
  let currentLevel: Person[] = roots

  while (currentLevel.length > 0) {
    const nextLevel: Person[] = []

    currentLevel.forEach((parent) => {
      const children = adj.childrenByPersonId.get(parent.id) || []
      children.forEach((child) => {
        if (seen.has(child.id)) return
        seen.add(child.id)
        nextLevel.push(child)
        result.push(child)

        const spouses = adj.spousesByPersonId.get(child.id) || []
        spouses.forEach(({ person: spouse }) => {
          if (seen.has(spouse.id)) return
          seen.add(spouse.id)
          result.push(spouse)
        })
      })
    })

    currentLevel = nextLevel
  }

  return result.filter((p) => !p.is_deceased)
}

/**
 * Danh sách kỳ siêu: toàn bộ hương linh (người đã mất) trong gia phả,
 * người được chọn đứng đầu, phần còn lại xếp theo đời rồi thứ tự sinh.
 * Người chưa rõ đời/thứ tự sinh xếp về cuối.
 */
export function buildMemorialList(mainId: string, persons: Person[]): Person[] {
  const deceased = persons.filter((p) => p.is_deceased)
  const main = deceased.find((p) => p.id === mainId)

  const rest = deceased
    .filter((p) => p.id !== mainId)
    .sort((a, b) => {
      const byGeneration =
        (a.generation ?? Infinity) - (b.generation ?? Infinity)
      if (byGeneration) return byGeneration

      const byOrder = (a.birth_order ?? Infinity) - (b.birth_order ?? Infinity)
      if (byOrder) return byOrder

      const byYear = (a.birth_year ?? Infinity) - (b.birth_year ?? Infinity)
      if (byYear) return byYear

      return a.full_name.localeCompare(b.full_name, 'vi')
    })

  return main ? [main, ...rest] : rest
}
