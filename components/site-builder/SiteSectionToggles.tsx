'use client'

import { type SiteSectionConfig, type SiteSectionId } from '@/lib/site-templates'

type SiteSectionTogglesProps = {
  value: SiteSectionConfig[]
  onChange: (sections: SiteSectionConfig[]) => void
}

const sectionLabels: Record<SiteSectionId, { label: string; description: string }> = {
  hero: { label: 'Capa do site', description: 'Título, subtítulo e botão principal.' },
  benefits: { label: 'Benefícios', description: 'Motivos para escolher sua empresa.' },
  catalog: { label: 'Catálogo/Cardápio/Serviços', description: 'Produtos e serviços cadastrados.' },
  highlights: { label: 'Destaques', description: 'Bloco de ofertas, diferenciais ou itens principais.' },
  delivery: { label: 'Entrega e pagamento', description: 'Informações úteis para pedidos.' },
  uploadInfo: { label: 'Envio de arquivos', description: 'Orientações para artes, referências e arquivos.' },
  process: { label: 'Como funciona', description: 'Passo a passo do atendimento.' },
  gallery: { label: 'Galeria', description: 'Fotos e imagens do negócio.' },
  testimonials: { label: 'Depoimentos', description: 'Prova social de clientes.' },
  professionals: { label: 'Profissionais', description: 'Equipe ou especialistas.' },
  warranty: { label: 'Garantia/Segurança', description: 'Condições e confiança.' },
  faq: { label: 'Perguntas frequentes', description: 'Dúvidas comuns.' },
  contact: { label: 'Contato', description: 'Chamada final para WhatsApp.' },
}

export default function SiteSectionToggles({ value, onChange }: SiteSectionTogglesProps) {
  function toggle(section: SiteSectionConfig) {
    onChange(value.map((item) => item.id === section.id ? { ...item, enabled: !item.enabled } : item))
  }

  return (
    <div className="rounded-[1.7rem] border border-blue-100 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">Seções do site</p>
      <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">Ligue ou desligue blocos</h3>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
        O sistema salva a estrutura técnica por baixo. Aqui você só escolhe o que aparece.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {value.map((section) => {
          const meta = sectionLabels[section.id] || { label: section.id, description: 'Bloco do site.' }

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => toggle(section)}
              className={`rounded-[1.4rem] border p-4 text-left transition hover:-translate-y-0.5 ${
                section.enabled
                  ? 'border-[#05245c] bg-blue-50 shadow-lg shadow-blue-950/5'
                  : 'border-blue-100 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                  section.enabled ? 'bg-[#05245c] text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {section.enabled ? '✓' : '○'}
                </span>
                <span>
                  <span className="block font-black text-[#071b3a]">{meta.label}</span>
                  <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">{meta.description}</span>
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
