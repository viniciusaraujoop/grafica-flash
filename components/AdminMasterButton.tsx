'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminMasterButton() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function verificarAdmin() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const email = sessionData.session?.user?.email

        if (!email) {
          setIsAdmin(false)
          setChecked(true)
          return
        }

        const { data, error } = await supabase
          .from('admin_users')
          .select('email, ativo')
          .eq('email', email.toLowerCase())
          .eq('ativo', true)
          .maybeSingle()

        if (error || !data) {
          setIsAdmin(false)
          setChecked(true)
          return
        }

        setIsAdmin(true)
      } catch {
        setIsAdmin(false)
      } finally {
        setChecked(true)
      }
    }

    verificarAdmin()
  }, [])

  if (!checked || !isAdmin) return null

  return (
    <Link
      href="/admin"
      className="inline-flex items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c] transition hover:bg-blue-100"
    >
      Admin master
    </Link>
  )
}
