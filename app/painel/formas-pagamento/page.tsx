import { redirect } from 'next/navigation'

export default function FormasPagamentoRedirectPage() {
  redirect('/painel/pagamentos?tab=formas')
}
