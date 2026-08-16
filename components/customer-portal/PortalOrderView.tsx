import Image from 'next/image'
import type {
  CustomerPortalOrder,
  CustomerPortalStatusTone,
} from '@/lib/customer-portal/contracts'

const statusClasses: Record<CustomerPortalStatusTone, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-800',
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0)
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return 'A definir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'A definir'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

export function PortalOrderView({ portal }: { portal: CustomerPortalOrder }) {
  const { company, order, items, timeline, delivery } = portal

  return (
    <main
      className="min-h-dvh bg-slate-100 px-3 py-4 text-slate-950 sm:px-6 sm:py-8"
      style={{
        '--portal-primary': company.primaryColor,
        '--portal-accent': company.accentColor,
      } as React.CSSProperties}
    >
      <div className="mx-auto grid max-w-5xl gap-4 sm:gap-6">
        <header
          className="overflow-hidden rounded-3xl px-5 py-6 text-white shadow-xl sm:px-8 sm:py-8"
          style={{ backgroundColor: 'var(--portal-primary)' }}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            {company.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={`Logo de ${company.name}`}
                width={64}
                height={64}
                priority
                className="h-14 w-14 rounded-2xl bg-white object-contain p-1.5 sm:h-16 sm:w-16"
              />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-xl font-black sm:h-16 sm:w-16">
                {company.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">
                Área do seu pedido
              </p>
              <p className="mt-1 truncate text-xl font-black sm:text-2xl">
                {company.name}
              </p>
            </div>
          </div>

          <div className="mt-7">
            <p className="text-sm font-bold text-white/70">
              {order.publicOrderNumber
                ? `Pedido ${order.publicOrderNumber}`
                : 'Seu pedido'}
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">
              {order.title}
            </h1>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Status atual
          </p>
          <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight">
                {order.status.label}
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
                {order.status.description}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black ${statusClasses[order.status.tone]}`}
            >
              Atualizado
            </span>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr] lg:gap-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Acompanhamento
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Histórico do pedido
            </h2>

            {timeline.length > 0 ? (
              <ol className="mt-6 grid gap-0">
                {timeline.map((event, index) => (
                  <li
                    key={`${event.title}:${event.occurredAt || index}`}
                    className="relative grid grid-cols-[2.5rem_1fr] gap-3 pb-6 last:pb-0"
                  >
                    {index < timeline.length - 1 ? (
                      <span className="absolute left-[1.18rem] top-9 h-[calc(100%-1rem)] w-0.5 bg-slate-200" />
                    ) : null}
                    <span
                      className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-4 border-white text-sm font-black shadow-sm ${
                        event.current
                          ? 'bg-[var(--portal-primary)] text-white'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {event.current ? '●' : '✓'}
                    </span>
                    <div className="pt-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h3 className="font-black">{event.title}</h3>
                        <time className="text-xs font-bold text-slate-400">
                          {formatDate(event.occurredAt, true)}
                        </time>
                      </div>
                      <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                        {event.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
                As próximas atualizações aparecerão aqui.
              </p>
            )}
          </section>

          <div className="grid content-start gap-4 sm:gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Itens
              </p>
              <h2 className="mt-2 text-xl font-black">Seu pedido</h2>
              {items.length > 0 ? (
                <ul className="mt-4 divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <li
                      key={`${item.name}:${index}`}
                      className="grid grid-cols-[1fr_auto] gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Quantidade: {item.quantity}
                        </p>
                      </div>
                      {item.total !== null ? (
                        <p className="font-black">{formatMoney(item.total)}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
                  Os itens detalhados ainda não foram informados.
                </p>
              )}
            </section>

            {order.totals ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Valores
                </p>
                <dl className="mt-4 grid gap-3 text-sm">
                  {order.totals.subtotal > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="font-medium text-slate-500">Subtotal</dt>
                      <dd className="font-bold">{formatMoney(order.totals.subtotal)}</dd>
                    </div>
                  ) : null}
                  {order.totals.discount > 0 ? (
                    <div className="flex justify-between gap-3 text-emerald-700">
                      <dt className="font-medium">Desconto</dt>
                      <dd className="font-bold">- {formatMoney(order.totals.discount)}</dd>
                    </div>
                  ) : null}
                  {order.totals.deliveryFee > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="font-medium text-slate-500">Entrega</dt>
                      <dd className="font-bold">{formatMoney(order.totals.deliveryFee)}</dd>
                    </div>
                  ) : null}
                  <div className="mt-1 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                    <dt className="font-black">Total informado</dt>
                    <dd className="text-xl font-black">{formatMoney(order.totals.total)}</dd>
                  </div>
                </dl>
              </section>
            ) : null}

            {delivery ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Recebimento
                </p>
                <h2 className="mt-2 text-xl font-black">{delivery.label}</h2>
                <dl className="mt-4 grid gap-3 text-sm">
                  {delivery.status ? (
                    <div>
                      <dt className="font-medium text-slate-500">Status</dt>
                      <dd className="mt-1 font-bold">{delivery.status}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="font-medium text-slate-500">Previsão</dt>
                    <dd className="mt-1 font-bold">{formatDate(delivery.estimatedAt)}</dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-6">
          <h2 className="font-black">Precisa de ajuda?</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            Fale com a empresa pelo mesmo canal em que você recebeu este link.
          </p>
        </section>

        <footer className="pb-4 text-center text-xs font-bold text-slate-400">
          Powered by Orçaly
        </footer>
      </div>
    </main>
  )
}
