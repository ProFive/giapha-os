export function getGalleryStoragePath(value: string): string {
  if (!value) return value

  try {
    const url = new URL(value)
    const marker = '/storage/v1/object/'
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex >= 0) {
      const path = url.pathname.slice(markerIndex + marker.length)
      const [, , ...segments] = path.split('/')
      return decodeURIComponent(segments.join('/'))
    }
  } catch {
    // The value is already a storage path.
  }

  return value.replace(/^\/+/, '')
}

/** Tách đường dẫn trong bucket `news` ra khỏi URL đã lưu, giống gallery. */
export function getNewsStoragePath(value: string): string {
  return getGalleryStoragePath(value)
}
