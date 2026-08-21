'use client'

import dynamic from 'next/dynamic'

const HomeAiChatV2 = dynamic(
  () => import('@/components/home/HomeAiChatV2'),
  {
    ssr: false,
    loading: () => null,
  },
)

export default function HomeAiChat() {
  return <HomeAiChatV2 />
}
