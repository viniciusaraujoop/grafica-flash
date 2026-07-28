export type ProductOptionSelection = 'single' | 'multiple'

export type ProductOption = {
  id: string
  name: string
  price: number
  active: boolean
}

export type ProductOptionGroup = {
  id: string
  name: string
  selection: ProductOptionSelection
  required: boolean
  min: number
  max: number
  options: ProductOption[]
}

export type ProductOptionSelections = Record<string, string[]>

type ProductWithOptions = {
  extras?: Record<string, unknown> | null
  variations?: unknown
  addons?: unknown
  variacoes?: unknown
  adicionais?: unknown
  configuracoes?: Record<string, unknown> | null
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function textValue(value: unknown) {
  return String(value ?? '').trim()
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function safeId(value: unknown, fallback: string) {
  const normalized = textValue(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || fallback
}

function optionName(record: Record<string, unknown>) {
  return textValue(
    record.name ||
      record.nome ||
      record.title ||
      record.titulo ||
      record.label,
  )
}

function optionPrice(record: Record<string, unknown>) {
  return Math.max(
    0,
    numberValue(
      record.price ??
        record.preco ??
        record.valor ??
        record.priceDelta ??
        record.price_delta ??
        record.preco_adicional ??
        record.ajuste_valor,
    ),
  )
}

function normalizeOption(
  value: unknown,
  fallbackId: string,
  fallbackName: string,
): ProductOption {
  const record = asRecord(value)

  return {
    id: safeId(
      record.id ||
        record.key ||
        record.value ||
        record.slug ||
        optionName(record),
      fallbackId,
    ),
    name: optionName(record) || fallbackName,
    price: optionPrice(record),
    active: record.active !== false && record.ativo !== false,
  }
}

function normalizeOptionList(value: unknown, prefix: string) {
  return asArray(value)
    .flatMap((item, itemIndex) => {
      const record = asRecord(item)
      const nested = asArray(
        record.options ||
          record.opcoes ||
          record.valores ||
          record.items,
      )

      if (nested.length) {
        const groupName = textValue(
          record.name ||
            record.nome ||
            record.title ||
            record.titulo ||
            record.label,
        )

        return nested.map((nestedOption, optionIndex) => {
          const normalized = normalizeOption(
            nestedOption,
            `${prefix}_${itemIndex}_${optionIndex}`,
            `Opção ${optionIndex + 1}`,
          )

          return {
            ...normalized,
            name: groupName
              ? `${groupName}: ${normalized.name}`
              : normalized.name,
          }
        })
      }

      return [
        normalizeOption(
          item,
          `${prefix}_${itemIndex}`,
          `Opção ${itemIndex + 1}`,
        ),
      ]
    })
    .filter((option) => option.name && option.active)
}

function dedupeOptions(options: ProductOption[]) {
  const seen = new Set<string>()

  return options.filter((option) => {
    if (seen.has(option.id)) return false
    seen.add(option.id)
    return true
  })
}

function normalizeSelection(value: unknown): ProductOptionSelection {
  const normalized = textValue(value).toLowerCase()

  if (
    normalized === 'multiple' ||
    normalized === 'multi' ||
    normalized === 'checkbox' ||
    normalized === 'multipla' ||
    normalized === 'múltipla'
  ) {
    return 'multiple'
  }

  return 'single'
}

function normalizeCanonicalGroups(value: unknown): ProductOptionGroup[] {
  return asArray(value)
    .map((rawGroup, groupIndex) => {
      const record = asRecord(rawGroup)
      const selection = normalizeSelection(
        record.selection ||
          record.selection_type ||
          record.tipo_selecao ||
          record.type ||
          record.tipo,
      )
      const options = dedupeOptions(
        normalizeOptionList(
          record.options ||
            record.opcoes ||
            record.valores ||
            record.items,
          `group_${groupIndex}`,
        ),
      )
      const required =
        record.required === true ||
        record.obrigatorio === true ||
        record.obrigatória === true
      const rawMin = Math.max(
        0,
        Math.floor(
          numberValue(
            record.min ??
              record.minimum ??
              record.min_choices ??
              record.minimo,
          ),
        ),
      )
      const rawMax = Math.max(
        0,
        Math.floor(
          numberValue(
            record.max ??
              record.maximum ??
              record.max_choices ??
              record.maximo,
          ),
        ),
      )
      const max =
        selection === 'single'
          ? 1
          : Math.max(
              1,
              Math.min(
                options.length || 1,
                rawMax || options.length || 1,
              ),
            )
      const min =
        selection === 'single'
          ? required
            ? 1
            : 0
          : Math.min(max, required ? Math.max(1, rawMin) : rawMin)

      return {
        id: safeId(
          record.id ||
            record.key ||
            record.slug ||
            record.name ||
            record.nome,
          `group_${groupIndex}`,
        ),
        name:
          textValue(
            record.name ||
              record.nome ||
              record.title ||
              record.titulo ||
              record.label,
          ) || `Grupo ${groupIndex + 1}`,
        selection,
        required,
        min,
        max,
        options,
      }
    })
    .filter((group) => group.options.length > 0)
}

export function getProductOptionGroups(
  product: ProductWithOptions,
): ProductOptionGroup[] {
  const extras = asRecord(product.extras)
  const config = asRecord(product.configuracoes)
  const canonical = normalizeCanonicalGroups(
    extras.option_groups ||
      extras.optionGroups ||
      config.option_groups ||
      config.optionGroups,
  )

  if (canonical.length) return canonical

  const variations = dedupeOptions([
    ...normalizeOptionList(product.variations, 'variation'),
    ...normalizeOptionList(product.variacoes, 'variation_pt'),
    ...normalizeOptionList(extras.variations, 'variation_extra'),
    ...normalizeOptionList(extras.variacoes, 'variation_extra_pt'),
    ...normalizeOptionList(config.variations, 'variation_config'),
    ...normalizeOptionList(config.variacoes, 'variation_config_pt'),
    ...normalizeOptionList(config.opcoes, 'variation_config_option'),
  ])

  const addons = dedupeOptions([
    ...normalizeOptionList(product.addons, 'addon'),
    ...normalizeOptionList(product.adicionais, 'addon_pt'),
    ...normalizeOptionList(extras.addons, 'addon_extra'),
    ...normalizeOptionList(extras.adicionais, 'addon_extra_pt'),
    ...normalizeOptionList(config.addons, 'addon_config'),
    ...normalizeOptionList(config.adicionais, 'addon_config_pt'),
  ])

  const groups: ProductOptionGroup[] = []

  if (variations.length) {
    groups.push({
      id: 'legacy_variation',
      name: 'Variação',
      selection: 'single',
      required: false,
      min: 0,
      max: 1,
      options: variations,
    })
  }

  if (addons.length) {
    groups.push({
      id: 'legacy_addons',
      name: 'Adicionais',
      selection: 'multiple',
      required: false,
      min: 0,
      max: addons.length,
      options: addons,
    })
  }

  return groups
}

export function sanitizeProductOptionGroups(
  groups: ProductOptionGroup[],
): ProductOptionGroup[] {
  return groups
    .map((group, groupIndex) => {
      const options = dedupeOptions(
        group.options
          .map((option, optionIndex) => ({
            id: safeId(
              option.id || option.name,
              `group_${groupIndex}_option_${optionIndex}`,
            ),
            name:
              textValue(option.name) || `Opção ${optionIndex + 1}`,
            price: Math.max(0, numberValue(option.price)),
            active: option.active !== false,
          }))
          .filter((option) => option.name && option.active),
      )
      const selection = normalizeSelection(group.selection)
      const max =
        selection === 'single'
          ? 1
          : Math.max(
              1,
              Math.min(
                options.length || 1,
                Math.floor(numberValue(group.max)) ||
                  options.length ||
                  1,
              ),
            )
      const required = group.required === true
      const min =
        selection === 'single'
          ? required
            ? 1
            : 0
          : Math.min(
              max,
              required
                ? Math.max(1, Math.floor(numberValue(group.min)))
                : Math.max(0, Math.floor(numberValue(group.min))),
            )

      return {
        id: safeId(
          group.id || group.name,
          `group_${groupIndex}`,
        ),
        name: textValue(group.name) || `Grupo ${groupIndex + 1}`,
        selection,
        required,
        min,
        max,
        options,
      }
    })
    .filter((group) => group.options.length > 0)
}

export function buildCheckoutCompatibility(
  groups: ProductOptionGroup[],
) {
  const normalized = sanitizeProductOptionGroups(groups)
  const firstSingleIndex = normalized.findIndex(
    (group) => group.selection === 'single',
  )

  const variations =
    firstSingleIndex >= 0
      ? normalized[firstSingleIndex].options.map((option) => ({
          id: option.id,
          name: `${normalized[firstSingleIndex].name}: ${option.name}`,
          nome: `${normalized[firstSingleIndex].name}: ${option.name}`,
          price: option.price,
          priceDelta: option.price,
          price_delta: option.price,
          preco: option.price,
          preco_adicional: option.price,
        }))
      : []

  const addons = normalized.flatMap((group, groupIndex) => {
    if (groupIndex === firstSingleIndex) return []

    return group.options.map((option) => ({
      id: option.id,
      name: `${group.name}: ${option.name}`,
      nome: `${group.name}: ${option.name}`,
      price: option.price,
      preco: option.price,
      preco_adicional: option.price,
      group_id: group.id,
      group_name: group.name,
      selection: group.selection,
    }))
  })

  return {
    groups: normalized,
    firstSingleGroupId:
      firstSingleIndex >= 0 ? normalized[firstSingleIndex].id : null,
    variations,
    addons,
  }
}

export function validateProductOptionSelections(
  groups: ProductOptionGroup[],
  selections: ProductOptionSelections,
) {
  for (const group of sanitizeProductOptionGroups(groups)) {
    const availableIds = new Set(
      group.options
        .filter((option) => option.active)
        .map((option) => option.id),
    )
    const selected = Array.from(
      new Set(
        asArray<string>(selections[group.id]).filter((id) =>
          availableIds.has(id),
        ),
      ),
    )
    const minimum =
      group.selection === 'single'
        ? group.required
          ? 1
          : 0
        : group.required
          ? Math.max(1, group.min)
          : group.min
    const maximum =
      group.selection === 'single'
        ? 1
        : Math.max(1, group.max)

    if (selected.length < minimum) {
      return minimum === 1
        ? `Escolha uma opção em "${group.name}".`
        : `Escolha pelo menos ${minimum} opções em "${group.name}".`
    }

    if (selected.length > maximum) {
      return `Escolha no máximo ${maximum} opções em "${group.name}".`
    }
  }

  return ''
}

export function getOptionSelectionsPrice(
  groups: ProductOptionGroup[],
  selections: ProductOptionSelections,
) {
  return sanitizeProductOptionGroups(groups).reduce(
    (total, group) => {
      const selectedIds = new Set(
        asArray<string>(selections[group.id]),
      )

      return (
        total +
        group.options
          .filter(
            (option) =>
              option.active && selectedIds.has(option.id),
          )
          .reduce((sum, option) => sum + option.price, 0)
      )
    },
    0,
  )
}

export function getOptionSelectionSummary(
  groups: ProductOptionGroup[],
  selections: ProductOptionSelections,
) {
  return sanitizeProductOptionGroups(groups)
    .map((group) => {
      const selectedIds = new Set(
        asArray<string>(selections[group.id]),
      )
      const names = group.options
        .filter(
          (option) =>
            option.active && selectedIds.has(option.id),
        )
        .map((option) => option.name)

      return names.length ? `${group.name}: ${names.join(', ')}` : ''
    })
    .filter(Boolean)
    .join(' | ')
}

export function getCheckoutOptionPayload(
  groups: ProductOptionGroup[],
  selections: ProductOptionSelections,
) {
  const normalized = sanitizeProductOptionGroups(groups)
  const firstSingleIndex = normalized.findIndex(
    (group) => group.selection === 'single',
  )
  const variationId =
    firstSingleIndex >= 0
      ? asArray<string>(
          selections[normalized[firstSingleIndex].id],
        )[0] || undefined
      : undefined
  const addonIds = normalized.flatMap((group, groupIndex) =>
    groupIndex === firstSingleIndex
      ? []
      : asArray<string>(selections[group.id]),
  )

  return {
    variationId,
    addonIds: Array.from(new Set(addonIds)),
  }
}

export function countProductOptionGroups(
  product: ProductWithOptions,
) {
  return getProductOptionGroups(product).length
}
