'use client'

import { PanelButton, PanelErrorState } from '@/components/panel-ui'

export default function PainelError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="panel-page flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        <PanelErrorState
          title="Nao foi possivel abrir esta area"
          description={error.message || 'Ocorreu um erro inesperado. Tente novamente sem perder o restante do painel.'}
          action={<PanelButton onClick={reset}>Tentar novamente</PanelButton>}
        />
      </div>
    </main>
  )
}