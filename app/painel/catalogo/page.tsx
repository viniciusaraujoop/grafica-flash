import { redirect } from 'next/navigation'

export default function CatalogoPage() {
  redirect('/painel/produtos?origem=catalogo')
}
