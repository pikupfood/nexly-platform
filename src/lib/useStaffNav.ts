'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface StaffNav {
  isStaff: boolean
  backHref: string   // '/staff/dashboard' se staff, '/dashboard' se proprietario
  dashboardHref: string
  profile: any | null
}

// Cache in-memory per evitare chiamate ripetute
let _cache: { isStaff: boolean; profile: any } | null = null
let _cacheTs = 0
const CACHE_TTL = 30_000 // 30 sec

export function useStaffNav(): StaffNav {
  const [nav, setNav] = useState<StaffNav>({
    isStaff: false,
    backHref: '/dashboard',
    dashboardHref: '/dashboard',
    profile: null,
  })

  useEffect(() => {
    const now = Date.now()
    if (_cache && now - _cacheTs < CACHE_TTL) {
      setNav({
        isStaff: _cache.isStaff,
        backHref: _cache.isStaff ? '/staff/dashboard' : '/dashboard',
        dashboardHref: _cache.isStaff ? '/staff/dashboard' : '/dashboard',
        profile: _cache.profile,
      })
      return
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: prof } = await supabase.rpc('get_staff_profile', { p_user_id: user.id })
      const isStaff = !!prof
      _cache = { isStaff, profile: prof }
      _cacheTs = Date.now()
      setNav({
        isStaff,
        backHref: isStaff ? '/staff/dashboard' : '/dashboard',
        dashboardHref: isStaff ? '/staff/dashboard' : '/dashboard',
        profile: prof,
      })
    })
  }, [])

  return nav
}
