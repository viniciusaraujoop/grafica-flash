// ORCALY_OWNER_BACKOFFICE_V2
import { redirect } from 'next/navigation'

export default function AdminLoginPage() {
  redirect('/parceiros/login?portal=interno')
}
