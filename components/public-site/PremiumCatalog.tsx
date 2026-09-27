'use client'

import type { PublicSiteCompany, PublicSiteProduct } from '@/components/public-site/PublicSiteRenderer'
import FoodMarketplaceCatalog from '@/components/public-site/FoodMarketplaceCatalog'
import SegmentMarketplaceCatalog from '@/components/public-site/SegmentMarketplaceCatalog'
import { normalizeCatalogBusinessType } from '@/lib/catalog-labels'

type PremiumCatalogProps = {
  company: PublicSiteCompany
  products: PublicSiteProduct[]
  businessType: string
  primaryColor: string
  accentColor: string
  fallbackTitle: string
  fallbackText: string
  ctaLabel?: string
}

export default function PremiumCatalog({
  company,
  products,
  businessType,
  primaryColor,
  accentColor,
  fallbackTitle,
  fallbackText,
}: PremiumCatalogProps) {
  const normalizedType = normalizeCatalogBusinessType(businessType || company.business_type || company.site_template)

  if (normalizedType === 'food') {
    return (
      <FoodMarketplaceCatalog
        company={company}
        products={products}
        primaryColor={primaryColor}
        accentColor={accentColor}
        fallbackTitle={fallbackTitle}
        fallbackText={fallbackText}
      />
    )
  }

  return (
    <SegmentMarketplaceCatalog
      company={company}
      products={products}
      businessType={normalizedType}
      primaryColor={primaryColor}
      accentColor={accentColor}
      fallbackTitle={fallbackTitle}
      fallbackText={fallbackText}
    />
  )
}
