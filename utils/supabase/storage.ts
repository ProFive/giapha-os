import { createClient } from '@/utils/supabase/client'

export async function uploadGalleryImage(
  file: File
): Promise<{ path: string | null; error: Error | null }> {
  try {
    const supabase = createClient()

    // Generate a unique filename using timestamp and a random string
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('gallery')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw uploadError
    }

    return { path: filePath, error: null }
  } catch (error) {
    console.error('Error uploading image:', error)
    return { path: null, error: error as Error }
  }
}

export async function uploadNewsImage(
  file: File
): Promise<{ path: string | null; error: Error | null }> {
  try {
    const supabase = createClient()

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('news')
      .upload(fileName, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      throw uploadError
    }

    return { path: fileName, error: null }
  } catch (error) {
    console.error('Error uploading news image:', error)
    return { path: null, error: error as Error }
  }
}
