import { getUser, getProfile } from '@/utils/db/queries'
import { uploadFile, r2PublicUrl } from '@/utils/r2/storage'
import { NextResponse } from 'next/server'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

async function assertCanUpload() {
  const user = await getUser()
  if (!user) return null
  const profile = await getProfile(user.id)
  if (!profile?.is_active) return null
  return profile
}

export async function POST(request: Request, { params }: { params: Promise<{ bucket: string }> }) {
  const { bucket } = await params

  if (!['gallery', 'news', 'avatars'].includes(bucket)) {
    return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
  }

  const profile = await assertCanUpload()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const buffer = await file.arrayBuffer()
  const { key, error } = await uploadFile(
    bucket as 'gallery' | 'news' | 'avatars',
    fileName,
    buffer,
    file.type
  )

  if (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  return NextResponse.json({
    path: fileName,
    url: r2PublicUrl(bucket as 'gallery' | 'news' | 'avatars', fileName)
  })
}
