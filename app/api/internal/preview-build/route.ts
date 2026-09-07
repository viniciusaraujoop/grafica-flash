import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      environment: 'preview',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    },
    {
      headers: {
        'cache-control': 'private, no-store, no-cache, max-age=0',
      },
    },
  )
}
