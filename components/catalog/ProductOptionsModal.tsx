/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  buildCheckoutCompatibility,
  getProductOptionGroups,
  sanitizeProductOptionGroups,
  type ProductOption,
  type ProductOptionGroup,
  type ProductOptionSelection,
} from '@/lib/product-options'

type OptionItem = {
  id: string
  nome?: string | null
  extras?: Record<string, unknown> | null
  variations?: unknown
  addons?: unknown
}

type ProductOptionsModalProps = {
  item: OptionItem
  companyId: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function uniqueId(prefix: string) {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}${Math.random().toString(16).slice(2)}`

  return `${prefix}_${random}`
}

function createOption(): ProductOption {
  return {
    id: uniqueId('option'),
    name: '',
    price: 0,
    active: true,
  }
}

function createGroup(
  selection: ProductOptionSelection,
): ProductOptionGroup {
  const required = selection === 'single'

  return {
    id: uniqueId('group'),
    name: '',
    selection,
    required,
    min: required ? 1 : 0,
    max: 1,
    options: [createOption()],
  }
}

export default function ProductOptionsModal({
  item,
  companyId,
  onClose,
  onSaved,
}: ProductOptionsModalProps) {
  const currentExtras = useMemo(
    () => record(item.extras),
    [item.extras],
  )
  const initialGroups = useMemo(
    () => getProductOptionGroups(item),
    [item],
  )
  const [groups, setGroups] =
    useState<ProductOptionGroup[]>(initialGroups)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const optionCount = groups.reduce(
    (total, group) => total + group.options.length,
    0,
  )

  function updateGroup(
    groupId: string,
    update:
      | Partial<ProductOptionGroup>
      | ((
          group: ProductOptionGroup,
        ) => ProductOptionGroup),
  ) {
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) return group

        return typeof update === 'function'
          ? update(group)
          : { ...group, ...update }
      }),
    )
    setError('')
  }

  function setSelection(
    groupId: string,
    selection: ProductOptionSelection,
  ) {
    updateGroup(groupId, (group) => ({
      ...group,
      selection,
      required:
        selection === 'single' ? group.required : group.required,
      min:
        selection === 'single'
          ? group.required
            ? 1
            : 0
          : Math.min(
              Math.max(0, group.min),
              Math.max(1, group.options.length),
            ),
      max:
        selection === 'single'
          ? 1
          : Math.max(1, group.options.length),
    }))
  }

  function toggleRequired(groupId: string) {
    updateGroup(groupId, (group) => {
      const required = !group.required

      return {
        ...group,
        required,
        min:
          group.selection === 'single'
            ? required
              ? 1
              : 0
            : required
              ? Math.max(1, group.min)
              : Math.max(0, group.min),
      }
    })
  }

  function addOption(groupId: string) {
    updateGroup(groupId, (group) => {
      const options = [...group.options, createOption()]

      return {
        ...group,
        options,
        max:
          group.selection === 'single'
            ? 1
            : Math.max(group.max, options.length),
      }
    })
  }

  function updateOption(
    groupId: string,
    optionId: string,
    update: Partial<ProductOption>,
  ) {
    updateGroup(groupId, (group) => ({
      ...group,
      options: group.options.map((option) =>
        option.id === optionId
          ? { ...option, ...update }
          : option,
      ),
    }))
  }

  function removeOption(groupId: string, optionId: string) {
    updateGroup(groupId, (group) => {
      const options = group.options.filter(
        (option) => option.id !== optionId,
      )
      const nextMaximum =
        group.selection === 'single'
          ? 1
          : Math.max(
              1,
              Math.min(group.max, options.length || 1),
            )

      return {
        ...group,
        options,
        max: nextMaximum,
        min: Math.min(group.min, nextMaximum),
      }
    })
  }

  function removeGroup(groupId: string) {
    setGroups((current) =>
      current.filter((group) => group.id !== groupId),
    )
    setError('')
  }

  function moveGroup(groupIndex: number, direction: -1 | 1) {
    setGroups((current) => {
      const nextIndex = groupIndex + direction

      if (
        nextIndex < 0 ||
        nextIndex >= current.length
      ) {
        return current
      }

      const next = [...current]
      const [group] = next.splice(groupIndex, 1)
      next.splice(nextIndex, 0, group)
      return next
    })
  }

  function validate() {
    if (groups.length > 8) {
      return 'Use no máximo 8 grupos por item.'
    }

    if (optionCount > 60) {
      return 'Use no máximo 60 opções por item.'
    }

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex]
      const groupName = group.name.trim()

      if (!groupName) {
        return `Informe o nome do grupo ${groupIndex + 1}.`
      }

      if (!group.options.length) {
        return `Adicione pelo menos uma opção em "${groupName}".`
      }

      const names = new Set<string>()

      for (
        let optionIndex = 0;
        optionIndex < group.options.length;
        optionIndex += 1
      ) {
        const option = group.options[optionIndex]
        const name = option.name.trim()

        if (!name) {
          return `Informe o nome da opção ${optionIndex + 1} em "${groupName}".`
        }

        const normalizedName = name.toLocaleLowerCase('pt-BR')

        if (names.has(normalizedName)) {
          return `A opção "${name}" está repetida em "${groupName}".`
        }

        names.add(normalizedName)

        if (!Number.isFinite(Number(option.price)) || Number(option.price) < 0) {
          return `O valor adicional de "${name}" é inválido.`
        }
      }

      if (
        group.selection === 'multiple' &&
        Math.max(0, Number(group.min || 0)) >
          Math.max(1, Number(group.max || 1))
      ) {
        return `O mínimo de "${groupName}" não pode superar o máximo.`
      }
    }

    return ''
  }

  async function save() {
    setError('')

    const validation = validate()

    if (validation) {
      setError(validation)
      return
    }

    setSaving(true)

    const cleanGroups = sanitizeProductOptionGroups(groups)
    const compatibility =
      buildCheckoutCompatibility(cleanGroups)
    const nextExtras = {
      ...currentExtras,
      option_groups: cleanGroups,
      optionGroups: cleanGroups,
      option_groups_version: 1,
      variations: compatibility.variations,
      addons: compatibility.addons,
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({
        extras: nextExtras,
        variations: compatibility.variations,
        addons: compatibility.addons,
      })
      .eq('id', item.id)
      .eq('company_id', companyId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    await onSaved()
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center bg-[#071b3a]/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Configurar variações e complementos"
    >
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[2.3rem] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">
              Variações e complementos
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-4xl">
              {item.nome || 'Produto'}
            </h2>
            <p className="mt-2 max-w-3xl font-bold leading-7 text-slate-500">
              Crie grupos de escolha única ou múltipla, defina obrigatoriedade, limites e valores adicionais.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-500"
          >
            Fechar
          </button>
        </div>

        <div className="mt-5 grid gap-3 rounded-[1.7rem] border border-blue-100 bg-blue-50 p-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Grupos
            </p>
            <p className="mt-1 text-3xl font-black text-[#05245c]">
              {groups.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Opções
            </p>
            <p className="mt-1 text-3xl font-black text-[#05245c]">
              {optionCount}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Compatibilidade
            </p>
            <p className="mt-1 text-sm font-black leading-6 text-emerald-700">
              Checkout atual preservado
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5">
          {groups.map((group, groupIndex) => (
            <section
              key={group.id}
              className="rounded-[1.8rem] border border-blue-100 bg-[#f8fbff] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Grupo {groupIndex + 1}
                  </p>
                  <p className="mt-1 text-lg font-black text-[#071b3a]">
                    {group.name || 'Grupo sem nome'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveGroup(groupIndex, -1)}
                    disabled={groupIndex === 0}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-black text-[#05245c] disabled:opacity-35"
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGroup(groupIndex, 1)}
                    disabled={groupIndex === groups.length - 1}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-black text-[#05245c] disabled:opacity-35"
                  >
                    Descer
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                  >
                    Excluir grupo
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_0.7fr_0.6fr]">
                <label className="grid gap-2 text-sm font-black text-slate-600">
                  Nome do grupo
                  <input
                    value={group.name}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        name: event.target.value,
                      })
                    }
                    placeholder="Ex: Tamanho, Material, Adicionais"
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]"
                  />
                </label>

                <label className="grid gap-2 text-sm font-black text-slate-600">
                  Tipo de escolha
                  <select
                    value={group.selection}
                    onChange={(event) =>
                      setSelection(
                        group.id,
                        event.target.value as ProductOptionSelection,
                      )
                    }
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]"
                  >
                    <option value="single">Escolha única</option>
                    <option value="multiple">Escolha múltipla</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => toggleRequired(group.id)}
                  className={`self-end rounded-2xl px-4 py-3 text-left text-sm font-black ${
                    group.required
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-white text-slate-600'
                  }`}
                >
                  {group.required ? 'Obrigatório' : 'Opcional'}
                </button>
              </div>

              {group.selection === 'multiple' ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-black text-slate-600">
                    Mínimo de escolhas
                    <input
                      type="number"
                      min={group.required ? 1 : 0}
                      max={Math.max(1, group.options.length)}
                      value={group.min}
                      onChange={(event) =>
                        updateGroup(group.id, {
                          min: Math.max(
                            group.required ? 1 : 0,
                            Number(event.target.value || 0),
                          ),
                        })
                      }
                      className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-black text-slate-600">
                    Máximo de escolhas
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, group.options.length)}
                      value={group.max}
                      onChange={(event) =>
                        updateGroup(group.id, {
                          max: Math.max(
                            1,
                            Number(event.target.value || 1),
                          ),
                        })
                      }
                      className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none"
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl bg-white p-4 text-sm font-bold leading-6 text-slate-500">
                  O cliente poderá escolher no máximo uma opção deste grupo.
                </div>
              )}

              <div className="mt-4 grid gap-3">
                {group.options.map((option, optionIndex) => (
                  <div
                    key={option.id}
                    className="grid gap-3 rounded-2xl border border-blue-100 bg-white p-3 lg:grid-cols-[1fr_210px_auto]"
                  >
                    <label className="grid gap-2 text-sm font-black text-slate-600">
                      Opção {optionIndex + 1}
                      <input
                        value={option.name}
                        onChange={(event) =>
                          updateOption(
                            group.id,
                            option.id,
                            { name: event.target.value },
                          )
                        }
                        placeholder="Ex: Grande, Papel couchê, Bacon"
                        className="rounded-xl border border-blue-100 bg-[#f8fbff] px-4 py-3 font-bold outline-none"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-black text-slate-600">
                      Valor adicional
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={option.price}
                        onChange={(event) =>
                          updateOption(
                            group.id,
                            option.id,
                            {
                              price: Math.max(
                                0,
                                Number(event.target.value || 0),
                              ),
                            },
                          )
                        }
                        className="rounded-xl border border-blue-100 bg-[#f8fbff] px-4 py-3 font-bold outline-none"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        removeOption(group.id, option.id)
                      }
                      className="self-end rounded-xl bg-red-50 px-4 py-3 text-sm font-black text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addOption(group.id)}
                  className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 py-4 text-sm font-black text-[#05245c]"
                >
                  Adicionar opção
                </button>
              </div>
            </section>
          ))}

          {!groups.length ? (
            <div className="rounded-[1.8rem] border border-dashed border-blue-200 bg-[#f8fbff] p-8 text-center">
              <p className="text-2xl font-black text-[#071b3a]">
                Nenhum grupo configurado
              </p>
              <p className="mx-auto mt-2 max-w-xl font-bold leading-7 text-slate-500">
                O item continuará usando apenas o preço base até você adicionar uma variação ou complemento.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              setGroups((current) => [
                ...current,
                createGroup('single'),
              ])
            }
            className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 font-black text-[#05245c]"
          >
            Adicionar escolha única
          </button>
          <button
            type="button"
            onClick={() =>
              setGroups((current) => [
                ...current,
                createGroup('multiple'),
              ])
            }
            className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 font-black text-emerald-700"
          >
            Adicionar escolha múltipla
          </button>
        </div>

        {groups.length ? (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">
            O primeiro grupo de escolha única será enviado ao checkout como variação. Os demais grupos serão enviados como complementos, mantendo o cálculo seguro do servidor.
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60"
          >
            {saving
              ? 'Salvando...'
              : 'Salvar variações e complementos'}
          </button>
        </div>
      </div>
    </div>
  )
}
