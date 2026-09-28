/**
 * Orçaly frontend tokens. Pure data, no runtime side effects.
 * The CSS implementation lives in components/orcaly-next/design-system/design-system.module.css.
 */

export const ORCALY_SPACING = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96,
} as const

export const ORCALY_TYPE = {
  display: { size: 48, lineHeight: 1.05, weight: 600, tracking: '-0.045em', maxWidthCh: 18 },
  h1: { size: 36, lineHeight: 1.12, weight: 600, tracking: '-0.035em', maxWidthCh: 26 },
  h2: { size: 28, lineHeight: 1.18, weight: 600, tracking: '-0.025em', maxWidthCh: 34 },
  h3: { size: 22, lineHeight: 1.25, weight: 600, tracking: '-0.015em', maxWidthCh: 42 },
  body: { size: 16, lineHeight: 1.6, weight: 400, tracking: '0', maxWidthCh: 72 },
  small: { size: 14, lineHeight: 1.5, weight: 400, tracking: '0', maxWidthCh: 72 },
  caption: { size: 12, lineHeight: 1.4, weight: 500, tracking: '0.01em', maxWidthCh: 64 },
  mono: { size: 13, lineHeight: 1.5, weight: 500, tracking: '0', maxWidthCh: 72 },
  label: { size: 14, lineHeight: 1.35, weight: 600, tracking: '0', maxWidthCh: 48 },
  button: { size: 14, lineHeight: 1, weight: 700, tracking: '0', maxWidthCh: 32 },
} as const

export const ORCALY_RADIUS = {
  subtle: 6,
  control: 10,
  panel: 14,
  modal: 18,
  floating: 22,
  pill: 999,
} as const

export const ORCALY_DENSITY = {
  compact: { gap: 12, row: 40, section: 24 },
  comfortable: { gap: 16, row: 44, section: 32 },
  editorial: { gap: 24, row: 48, section: 48 },
} as const

export const ORCALY_BREAKPOINTS = {
  base: 0,
  md: 768,
  lg: 1024,
  xl: 1440,
  wide: 1920,
} as const

export const ORCALY_MOTION = {
  micro: { min: 120, max: 180 },
  ui: { min: 180, max: 260 },
  overlay: { min: 220, max: 320 },
  section: { min: 250, max: 400 },
  easing: {
    standard: 'cubic-bezier(.2,0,0,1)',
    enter: 'cubic-bezier(.16,1,.3,1)',
    exit: 'cubic-bezier(.4,0,1,1)',
  },
} as const

export const ORCALY_VIEWPORTS = [320, 390, 768, 1024, 1440, 1920] as const

export type OrcalyDensity = keyof typeof ORCALY_DENSITY
export type OrcalyBreakpoint = keyof typeof ORCALY_BREAKPOINTS
export type OrcalyTheme = 'light' | 'dark'
export type OrcalySurface = 'canvas' | 'surface' | 'elevated' | 'subtle' | 'interactive' | 'selected' | 'overlay'

export function isRequiredViewport(value: number): value is (typeof ORCALY_VIEWPORTS)[number] {
  return (ORCALY_VIEWPORTS as readonly number[]).includes(value)
}
