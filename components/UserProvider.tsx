'use client'

import { Profile } from '@/types'
import { createContext, useContext, ReactNode } from 'react'

interface AuthUser {
  id: string
  email: string
  created_at: string
}

interface UserState {
  user: AuthUser | null
  profile: Profile | null
  isAdmin: boolean
  isEditor: boolean
}

const UserContext = createContext<UserState | undefined>(undefined)

export function UserProvider({
  children,
  user,
  profile
}: {
  children: ReactNode
  user: AuthUser | null
  profile: Profile | null
}) {
  const isActive = Boolean(profile?.is_active)
  const isAdmin = isActive && profile?.role === 'admin'
  const isEditor = isActive && (profile?.role === 'editor' || isAdmin)

  return (
    <UserContext.Provider value={{ user, profile, isAdmin, isEditor }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
