import PanelPlaceholderPage from '@/components/painel/PanelPlaceholderPage'

type PageProps = {
  params: Promise<{ module: string }>
}

export default async function PainelModuloPage({ params }: PageProps) {
  const { module } = await params

  return <PanelPlaceholderPage moduleId={module} />
}
