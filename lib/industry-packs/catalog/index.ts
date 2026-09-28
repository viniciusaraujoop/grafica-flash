// Wave 1 Industry Pack catalog. Only these four packs are Wave 1.

import type { IndustryPackDefinition } from '../core/types'
import { foodRestaurantPack } from './food.restaurant'
import { graphicPrintShopPack } from './graphic.print_shop'
import { servicesGeneralPack } from './services.general'
import { storeLocalStorePack } from './store.local_store'

export const WAVE1_PACK_KEYS = ['graphic.print_shop', 'food.restaurant', 'services.general', 'store.local_store'] as const

export const industryPackCatalog: readonly IndustryPackDefinition[] = [
  graphicPrintShopPack,
  foodRestaurantPack,
  servicesGeneralPack,
  storeLocalStorePack,
]
