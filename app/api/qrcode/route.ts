import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'URL não informada.' }, { status: 400 })
    }

    const dataUrl = await QRCode.toDataURL(url, {
      margin: 2,
      scale: 8,
      errorCorrectionLevel: 'M',
    })

    const base64 = dataUrl.split(',')[1]
    const buffer = Buffer.from(base64, 'base64')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar QR Code.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
