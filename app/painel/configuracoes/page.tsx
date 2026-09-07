// ORCALY_SETTINGS_PREMIUM_PAGE_WRAPPER_V2
import Link from 'next/link'
import SettingsPremiumShell from '@/components/settings/SettingsPremiumShell'
import ConfiguracoesLegacy from './ConfiguracoesLegacy'

export default function ConfiguracoesPage() {
  return (
    <SettingsPremiumShell>
      <div className="mb-5 flex justify-end">
        <Link
          href="/painel/configuracoes/seguranca"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
        >
          Segurança da conta
        </Link>
      </div>
      <ConfiguracoesLegacy />
    </SettingsPremiumShell>
  )
}
