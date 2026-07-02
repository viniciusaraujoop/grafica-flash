'use client'

import { editorColorPalettes, getSuggestedEditorPalettes, type EditorColorPalette } from '@/lib/site-editor-colors'

type ColorPalettePickerProps = {
  businessType?: string | null
  primary?: string | null
  accent?: string | null
  onChange: (colors: { primary: string; accent: string; background?: string; theme?: string }) => void
}

function PaletteButton({
  palette,
  selected,
  onClick,
}: {
  palette: EditorColorPalette
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.4rem] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${
        selected ? 'border-[#05245c] bg-blue-50 shadow-lg shadow-blue-950/10' : 'border-blue-100 bg-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="h-8 w-8 rounded-full ring-2 ring-white" style={{ background: palette.primary }} />
        <span className="-ml-3 h-8 w-8 rounded-full ring-2 ring-white" style={{ background: palette.accent }} />
        <span className="-ml-3 h-8 w-8 rounded-full ring-2 ring-white" style={{ background: palette.background }} />
      </div>
      <p className="mt-3 font-black text-[#071b3a]">{palette.label}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{palette.description}</p>
    </button>
  )
}

export default function ColorPalettePicker({ businessType, primary, accent, onChange }: ColorPalettePickerProps) {
  const suggested = getSuggestedEditorPalettes(businessType)
  const selectedPrimary = primary || '#05245c'
  const selectedAccent = accent || '#06b6d4'

  return (
    <div className="space-y-5">
      <div className="rounded-[1.6rem] bg-blue-50 p-5">
        <p className="font-black text-[#05245c]">Cores e estilo</p>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
          Escolha uma paleta pronta ou personalize as cores visualmente. Você não precisa saber códigos de cor.
        </p>
      </div>

      <div>
        <p className="mb-3 text-sm font-black text-slate-600">Sugestões para seu segmento</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {suggested.map((palette) => (
            <PaletteButton
              key={palette.id}
              palette={palette}
              selected={selectedPrimary === palette.primary && selectedAccent === palette.accent}
              onClick={() => onChange({
                primary: palette.primary,
                accent: palette.accent,
                background: palette.background,
                theme: palette.id,
              })}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-black text-slate-600">Todas as paletas</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {editorColorPalettes.map((palette) => (
            <PaletteButton
              key={palette.id}
              palette={palette}
              selected={selectedPrimary === palette.primary && selectedAccent === palette.accent}
              onClick={() => onChange({
                primary: palette.primary,
                accent: palette.accent,
                background: palette.background,
                theme: palette.id,
              })}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-[1.6rem] border border-blue-100 bg-white p-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-black text-slate-600">Cor principal</span>
          <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-[#f8fbff] p-3">
            <input
              type="color"
              value={selectedPrimary}
              onChange={(event) => onChange({ primary: event.target.value, accent: selectedAccent })}
              className="h-12 w-14 cursor-pointer rounded-xl border-0 bg-transparent"
            />
            <span className="text-sm font-black text-[#071b3a]">Botões e títulos principais</span>
          </div>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-black text-slate-600">Cor de destaque</span>
          <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-[#f8fbff] p-3">
            <input
              type="color"
              value={selectedAccent}
              onChange={(event) => onChange({ primary: selectedPrimary, accent: event.target.value })}
              className="h-12 w-14 cursor-pointer rounded-xl border-0 bg-transparent"
            />
            <span className="text-sm font-black text-[#071b3a]">Detalhes, gradientes e realces</span>
          </div>
        </label>
      </div>

      <details className="rounded-[1.3rem] border border-blue-100 bg-white p-4">
        <summary className="cursor-pointer text-sm font-black text-[#05245c]">Avançado: ver códigos das cores</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={selectedPrimary}
            onChange={(event) => onChange({ primary: event.target.value, accent: selectedAccent })}
            className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 font-mono text-sm font-bold outline-none focus:border-[#05245c] focus:bg-white"
          />
          <input
            value={selectedAccent}
            onChange={(event) => onChange({ primary: selectedPrimary, accent: event.target.value })}
            className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 font-mono text-sm font-bold outline-none focus:border-[#05245c] focus:bg-white"
          />
        </div>
      </details>
    </div>
  )
}
