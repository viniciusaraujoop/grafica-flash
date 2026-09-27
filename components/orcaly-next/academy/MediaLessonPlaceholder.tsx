import type { AcademyContentItem, AcademyProgress } from '@/lib/orcaly-next/academy/types'
import { formatDuration } from '@/lib/orcaly-next/academy/core'
import { formatClock } from '@/lib/orcaly-next/academy/reading'
import { StatusPill } from '../foundation/primitives'
import styles from './academy.module.css'

const STATE_COPY = {
  NOT_CONFIGURED: { label: 'Mídia não configurada', detail: 'Nenhum arquivo ou player está ligado a este item ainda.' },
  EXTERNAL_ONLY: { label: 'Somente na fonte externa', detail: 'A mídia é reproduzida no site de origem, não aqui.' },
  AVAILABLE_METADATA_ONLY: { label: 'Somente metadados', detail: 'Título, duração e política de conclusão estão declarados; o player chega com a integração de mídia.' },
} as const
const AVAIL = { AVAILABLE: 'Disponível', NOT_AVAILABLE: 'Não disponível', UNKNOWN: 'Não informado' } as const

/**
 * Honest stand-in for video/audio. No external player, no fake playback, no auto-play:
 * it states what is known (duration, transcript, captions, resume point, completion rule).
 */
export default function MediaLessonPlaceholder({ item, progress, headingLevel = 2 }: { item: AcademyContentItem; progress: AcademyProgress | null; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  const media = item.media ?? { state: 'NOT_CONFIGURED' as const, transcript: 'UNKNOWN' as const, captions: 'UNKNOWN' as const }
  const copy = STATE_COPY[media.state]
  const kind = item.type === 'AUDIO' ? 'Áudio' : 'Vídeo'
  const position = progress?.position?.kind === 'SECONDS' ? progress.position.seconds : null
  const policy = item.completion.kind === 'PLAYBACK_THRESHOLD'
    ? `Conclusão ao atingir ${item.completion.thresholdBps / 100}% de reprodução medida, e só quando você confirmar.`
    : item.completion.kind === 'MANUAL' ? 'Conclusão manual: você marca quando terminar.' : 'Conclusão pelos itens obrigatórios.'
  const id = `midia-${item.id}`
  return (
    <section className={styles.media} aria-labelledby={id} data-media-state={media.state}>
      <Heading id={id}>{`${kind}: ${copy.label}`}</Heading>
      <div className={`${styles.mediaFrame} ${item.type === 'AUDIO' ? styles.mediaAudio : ''}`} role="note">
        {`${kind} não é reproduzido neste protótipo. ${copy.detail}`}
      </div>
      <dl className={styles.dl}>
        <dt>Estado</dt><dd><StatusPill tone={media.state === 'NOT_CONFIGURED' ? 'neutral' : 'info'}>{copy.label}</StatusPill></dd>
        <dt>Duração</dt><dd>{formatDuration(item.duration, 'seconds')}</dd>
        <dt>Transcrição</dt><dd>{AVAIL[media.transcript]}</dd>
        <dt>Legendas</dt><dd>{AVAIL[media.captions]}</dd>
        <dt>Posição salva</dt><dd>{position === null ? 'Nenhuma posição registrada' : formatClock(position)}</dd>
        <dt>Conclusão</dt><dd>{policy}</dd>
      </dl>
    </section>
  )
}
