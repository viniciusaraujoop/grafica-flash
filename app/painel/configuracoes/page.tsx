// ORCALY_SETTINGS_PREMIUM_PAGE_WRAPPER_V1
import SettingsPremiumShell from '@/components/settings/SettingsPremiumShell'
import ConfiguracoesLegacy from './ConfiguracoesLegacy'

export default function ConfiguracoesPage() {
  return (
    <SettingsPremiumShell>
      <ConfiguracoesLegacy />
    </SettingsPremiumShell>
  )
}