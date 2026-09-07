import { NextRequest, NextResponse } from 'next/server'

export class RequestBodyError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export async function readJsonBody<T = Record<string, unknown>>(
  request: NextRequest,
  maxBytes: number,
): Promise<T> {
  const declared = Number(request.headers.get('content-length') || 0)

  if (declared > maxBytes) {
    throw new RequestBodyError('Requisicao muito grande.', 413)
  }

  const buffer = await request.arrayBuffer()

  if (buffer.byteLength > maxBytes) {
    throw new RequestBodyError('Requisicao muito grande.', 413)
  }

  try {
    return JSON.parse(new TextDecoder().decode(buffer) || '{}') as T
  } catch {
    throw new RequestBodyError('JSON invalido.', 400)
  }
}

export function requestBodyErrorResponse(error: unknown) {
  if (error instanceof RequestBodyError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return null
}
