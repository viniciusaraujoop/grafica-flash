import { MetricCardSkeleton, PanelSkeleton, TableSkeleton } from '@/components/panel-ui'

export default function PainelLoading() {
  return (
    <main className="panel-page min-h-[calc(100vh-5rem)] px-4 py-5 sm:px-6 lg:px-8" aria-busy="true" aria-label="Carregando painel">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <PanelSkeleton className="h-3 w-24" />
            <PanelSkeleton className="mt-3 h-8 w-56 max-w-full" />
            <PanelSkeleton className="mt-3 h-4 w-[32rem] max-w-full" />
          </div>
          <PanelSkeleton className="h-11 w-36 rounded-xl" />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <MetricCardSkeleton key={index} />)}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <TableSkeleton rows={6} />
          <div className="panel-ui-section space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <PanelSkeleton className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <PanelSkeleton className="h-4 w-3/4" />
                  <PanelSkeleton className="mt-2 h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}