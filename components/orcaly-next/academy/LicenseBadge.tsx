import type { AcademyLicense } from '@/lib/orcaly-next/academy/types'
import { LICENSE_STATUS_LABEL, LICENSE_TYPE_LABEL, permittedActions } from '@/lib/orcaly-next/academy/core'
import { StatusPill } from '../foundation/primitives'
import styles from './academy.module.css'

/** License type + status as text (never color only). Tone follows what the license actually permits. */
export default function LicenseBadge({ license, now }: { license: AcademyLicense; now: string }) {
  const actions = permittedActions(license, now)
  const tone = license.type === 'EXTERNAL_LINK' ? 'info' : actions.renderFullContent ? 'success' : 'warning'
  return (
    <span className={styles.badgeWrap} data-license={license.type} data-license-status={license.status}>
      <StatusPill tone={tone}>{`Licença: ${LICENSE_TYPE_LABEL[license.type]} · ${LICENSE_STATUS_LABEL[license.status]}`}</StatusPill>
    </span>
  )
}
