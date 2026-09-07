import FounderActivationClient from '@/components/founders/FounderActivationClient'

export default async function FounderActivationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token =
    typeof params.token === 'string'
      ? params.token
      : ''

  return <FounderActivationClient token={token} />
}
