import { getDB } from '@/utils/db/client'
import { getIsAdmin } from '@/utils/db/queries'
import { getServerTranslations } from '@/lib/i18n/server'
import { r2PublicUrl } from '@/utils/r2/storage'
import GalleryClient from '@/components/GalleryClient'
import type { GalleryItem } from '@/types'

export async function generateMetadata() {
  const { t } = await getServerTranslations()
  return {
    title: `${t('galleryTitle')} | Nguyễn Tộc`,
    description: t('galleryDescription')
  }
}

export default async function GalleryPage() {
  const db = getDB()
  const isAdmin = await getIsAdmin()

  const res = await db
    .prepare(
      'SELECT * FROM gallery_items ORDER BY event_date DESC NULLS LAST'
    )
    .all<GalleryItem>()

  const items = (res.results ?? []).map((item) => ({
    ...item,
    // Normalise image_url to a proxied R2 URL; keep raw path as storage_path
    storage_path: item.image_url,
    image_url: item.image_url.startsWith('/')
      ? item.image_url
      : r2PublicUrl('gallery', item.image_url)
  }))

  return (
    <main className='mx-auto flex w-full max-w-7xl flex-1 flex-col p-4 sm:p-8'>
      <GalleryClient
        key={items.length}
        initialItems={items}
        isAdmin={isAdmin}
      />
    </main>
  )
}
