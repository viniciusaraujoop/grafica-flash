'use client'

import { getSiteTemplateByBusinessType } from '@/lib/site-templates'

export type BenefitEditorItem = {
  title: string
  text: string
}

type BenefitsEditorProps = {
  value: BenefitEditorItem[]
  businessType?: string | null
  onChange: (items: BenefitEditorItem[]) => void
  maxItems?: number
}

function clean(items: BenefitEditorItem[]) {
  return items
    .map((item) => ({
      title: item.title.trim(),
      text: item.text.trim(),
    }))
    .filter((item) => item.title || item.text)
}

export default function BenefitsEditor({ value, businessType, onChange, maxItems = 8 }: BenefitsEditorProps) {
  const template = getSiteTemplateByBusinessType(businessType)

  function updateItem(index: number, patch: Partial<BenefitEditorItem>) {
    onChange(value.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item))
  }

  function removeItem(index: number) {
    onChange(value.filter((_, currentIndex) => currentIndex !== index))
  }

  function addItem() {
    if (value.length >= maxItems) return
    onChange([...value, { title: '', text: '' }])
  }

  function useSuggestions() {
    if (clean(value).length > 0) {
      const confirmed = window.confirm('Deseja substituir os benefícios atuais pelas sugestões do seu segmento?')
      if (!confirmed) return
    }

    onChange(template.benefits.slice(0, maxItems))
  }

  return (
    <div className="rounded-[1.7rem] border border-blue-100 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">Benefícios</p>
          <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">Benefícios do seu negócio</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
            Mostre por que o cliente deve escolher sua empresa. Nada de código, só texto claro.
          </p>
        </div>

        <button type="button" onClick={useSuggestions} className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c]">
          Usar sugestões do meu segmento
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        {value.map((item, index) => (
          <div key={`benefit-${index}`} className="rounded-[1.4rem] bg-[#f8fbff] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black text-[#05245c] ring-1 ring-blue-100">
                {index + 1}
              </span>

              <div className="grid flex-1 gap-3">
                <input
                  value={item.title}
                  onChange={(event) => updateItem(index, { title: event.target.value })}
                  placeholder="Ex.: Atendimento rápido"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]"
                />
                <input
                  value={item.text}
                  onChange={(event) => updateItem(index, { text: event.target.value })}
                  placeholder="Descrição curta, opcional"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c]"
                />
              </div>

              <button type="button" onClick={() => removeItem(index)} className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-red-600 ring-1 ring-red-100">
                Remover
              </button>
            </div>
          </div>
        ))}

        {!value.length ? (
          <div className="rounded-[1.4rem] bg-[#f8fbff] p-5 text-center">
            <p className="font-black text-[#071b3a]">Nenhum benefício cadastrado.</p>
            <p className="mt-2 text-sm font-bold text-slate-500">Use sugestões do segmento ou adicione manualmente.</p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={addItem}
        disabled={value.length >= maxItems}
        className="mt-4 rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
      >
        + Adicionar benefício
      </button>
    </div>
  )
}

export function cleanBenefits(items: BenefitEditorItem[]) {
  return clean(items)
}
