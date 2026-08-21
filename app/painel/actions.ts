'use server'

import { revalidatePath } from 'next/cache'
import { redirect, RedirectType } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error(JSON.stringify({
      event: 'auth_logout_failure',
      route: '/painel',
      code: error.code || 'sign_out_failed',
    }))
    throw new Error('Não foi possível encerrar a sessão.')
  }

  console.info(JSON.stringify({
    event: 'auth_logout_success',
    route: '/painel',
  }))

  revalidatePath('/', 'layout')
  redirect('/login', RedirectType.replace)
}
