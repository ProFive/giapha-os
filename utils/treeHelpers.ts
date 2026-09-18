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
 * Tính đời của từng người so với người gốc: cha mẹ là -1, con là +1,
 * vợ/chồng cùng đời. Lan theo cả hai chiều nên phủ được mọi người nối
 * với người gốc qua huyết thống hoặc hôn nhân.
 * Cột `generation` trong CSDL thường bỏ trống nên không dùng được.
 */
function buildRelativeGenerations(
  rootId: string,
  relationships: Relationship[]
): Map<string, number> {
  // Cạnh vô hướng kèm mức chênh đời khi đi từ `from` sang `to`.
  const edges = new Map<string, { to: string; delta: number }[]>()
  const addEdge = (from: string, to: string, delta: number) => {
    if (!edges.has(from)) edges.set(from, [])
    edges.get(from)!.push({ to, delta })
  }

  relationships.forEach((r) => {
    if (r.type === 'marriage') {
      addEdge(r.person_a, r.person_b, 0)
      addEdge(r.person_b, r.person_a, 0)
    } else {
      addEdge(r.person_a, r.person_b, 1)
      addEdge(r.person_b, r.person_a, -1)
    }
  })

  const generations = new Map<string, number>([[rootId, 0]])
  let frontier = [rootId]

  while (frontier.length > 0) {
    const next: string[] = []
    frontier.forEach((id) => {
      const level = generations.get(id)!
      edges.get(id)?.forEach(({ to, delta }) => {
        if (generations.has(to)) return
        generations.set(to, level + delta)
        next.push(to)
      })
    })
    frontier = next
  }

  return generations
}

/**
 * Danh sách kỳ siêu: toàn bộ hương linh (người đã mất) trong gia phả.
 * Người được chọn đứng đầu, kế đến là vợ/chồng của họ, phần còn lại xếp
 * theo đời từ trên xuống (cha mẹ, ông bà trước con cháu) rồi tới thứ tự sinh.
 * Người không nối được với người được chọn xếp về cuối.
 */
export function buildMemorialList(
  mainId: string,
  persons: Person[],
  relationships: Relationship[] = []
): Person[] {
  const deceased = persons.filter((p) => p.is_deceased)
  const main = deceased.find((p) => p.id === mainId)

  const generations = buildRelativeGenerations(mainId, relationships)

  const spouseIds = new Set<string>()
  relationships.forEach((r) => {
    if (r.type !== 'marriage') return
    if (r.person_a === mainId) spouseIds.add(r.person_b)
    else if (r.person_b === mainId) spouseIds.add(r.person_a)
  })

  const byLineage = (a: Person, b: Person) => {
    const byGeneration =
      (generations.get(a.id) ?? Infinity) - (generations.get(b.id) ?? Infinity)
    if (byGeneration) return byGeneration

    const byOrder = (a.birth_order ?? Infinity) - (b.birth_order ?? Infinity)
    if (byOrder) return byOrder

    const byYear = (a.birth_year ?? Infinity) - (b.birth_year ?? Infinity)
    if (byYear) return byYear

    // Cùng đời mà không rõ thứ tự sinh: người trong họ đứng trước dâu/rể.
    const byBlood = Number(a.is_in_law) - Number(b.is_in_law)
    if (byBlood) return byBlood

    return a.full_name.localeCompare(b.full_name, 'vi')
  }

  const spouses = deceased
    .filter((p) => p.id !== mainId && spouseIds.has(p.id))
    .sort(byLineage)

  const rest = deceased
    .filter((p) => p.id !== mainId && !spouseIds.has(p.id))
    .sort(byLineage)

  return main ? [main, ...spouses, ...rest] : [...spouses, ...rest]
}
