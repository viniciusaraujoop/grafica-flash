'use client'

import { getSiteTemplateByBusinessType } from '@/lib/site-templates'

export type FaqEditorItem = {
  question: string
  answer: string
}

type FaqEditorProps = {
  value: FaqEditorItem[]
  businessType?: string | null
  onChange: (items: FaqEditorItem[]) => void
  maxItems?: number
}

function clean(items: FaqEditorItem[]) {
  return items
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question || item.answer)
}

export default function FaqEditor({ value, businessType, onChange, maxItems = 8 }: FaqEditorProps) {
  const template = getSiteTemplateByBusinessType(businessType)

  function updateItem(index: number, patch: Partial<FaqEditorItem>) {
    onChange(value.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item))
  }

  function removeItem(index: number) {
    onChange(value.filter((_, currentIndex) => currentIndex !== index))
  }

  function addItem() {
    if (value.length >= maxItems) return
    onChange([...value, { question: '', answer: '' }])
  }

  function useSuggestions() {
    if (clean(value).length > 0) {
      const confirmed = window.confirm('Deseja substituir as perguntas atuais pelas sugestões do seu segmento?')
      if (!confirmed) return
    }

    onChange(template.faq.slice(0, maxItems))
  }

  return (
    <div className="rounded-[1.7rem] border border-blue-100 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">FAQ</p>
          <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">Perguntas frequentes</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
            Responda dúvidas comuns antes do cliente chamar no WhatsApp.
          </p>
        </div>

        <button type="button" onClick={useSuggestions} className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c]">
          Usar perguntas sugeridas
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        {value.map((item, index) => (
          <div key={`faq-${index}`} className="rounded-[1.4rem] bg-[#f8fbff] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-[#071b3a]">Pergunta {index + 1}</p>
              <button type="button" onClick={() => removeItem(index)} className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-red-600 ring-1 ring-red-100">
                Remover pergunta
              </button>
            </div>

            <label className="mt-4 grid gap-2">
              <span className="text-sm font-black text-slate-600">Pergunta</span>
              <input
                value={item.question}
                onChange={(event) => updateItem(index, { question: event.target.value })}
                placeholder="Ex.: Vocês fazem entrega?"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]"
              />
            </label>

            <label className="mt-3 grid gap-2">
              <span className="text-sm font-black text-slate-600">Resposta</span>
              <textarea
                value={item.answer}
                onChange={(event) => updateItem(index, { answer: event.target.value })}
                placeholder="Ex.: Sim, fazemos entrega para algumas regiões. Consulte disponibilidade pelo WhatsApp."
                rows={3}
                className="resize-none rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c]"
              />
            </label>
          </div>
        ))}

        {!value.length ? (
          <div className="rounded-[1.4rem] bg-[#f8fbff] p-5 text-center">
            <p className="font-black text-[#071b3a]">Nenhuma pergunta cadastrada.</p>
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
        + Adicionar pergunta
      </button>
    </div>
  )
}

export function cleanFaq(items: FaqEditorItem[]) {
  return clean(items)
}
