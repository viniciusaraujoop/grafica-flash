import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const commit = String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim().toLowerCase()
  const branch = String(process.env.VERCEL_GIT_COMMIT_REF || '').trim()

  if (!/^[a-f0-9]{40}$/.test(commit)) {
    return NextResponse.json(
      { ready: false, error: 'commit_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    { ready: true, commit, branch },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
