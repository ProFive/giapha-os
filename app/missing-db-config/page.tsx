import { redirect } from 'next/navigation'

// Redirect to setup since we no longer use Supabase env vars
export default function MissingDbConfigPage() {
  redirect('/setup')
}
