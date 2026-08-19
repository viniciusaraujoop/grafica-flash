import type { ReactNode } from 'react'
import AdminShellV2 from '@/components/admin/AdminShellV2'

export default function InternalAdminLayout({ children }: { children: ReactNode }) {
  return <AdminShellV2>{children}</AdminShellV2>
}
