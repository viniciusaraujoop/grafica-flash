import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  return NextResponse.json({
    ok: true,
    email: admin.email,
    role: admin.role,
  })
}
