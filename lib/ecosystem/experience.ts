import type { CSSProperties } from 'react'
import type { ProductDefinition } from './products'

export function productTheme(product: ProductDefinition): CSSProperties {
  return {
    '--product-accent': product.experience.primary,
    '--product-surface': product.experience.surface,
    '--product-text': product.experience.text,
    '--product-motion': `${product.experience.motionMs}ms`,
  } as CSSProperties
}
