export type PixPayloadInput = {
  key: string
  merchantName: string
  merchantCity: string
  amount?: number
  txid?: string
  description?: string
}

function removeAccents(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function onlyAllowed(value: string, max: number) {
  return removeAccents(value)
    .replace(/[^\w\s\-\.\/@+]/g, '')
    .trim()
    .slice(0, max)
}

function field(id: string, value: string) {
  const size = String(value.length).padStart(2, '0')
  return `${id}${size}${value}`
}

function crc16(payload: string) {
  let crc = 0xffff

  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8

    for (let j = 0; j < 8; j += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc <<= 1
      }

      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function sanitizeTxid(value: string) {
  return String(value || 'ORCALY')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 25) || 'ORCALY'
}

export function generatePixPayload(input: PixPayloadInput) {
  const key = String(input.key || '').trim()
  if (!key) return ''

  const merchantName = onlyAllowed(input.merchantName || 'ORCALY', 25).toUpperCase() || 'ORCALY'
  const merchantCity = onlyAllowed(input.merchantCity || 'MACEIO', 15).toUpperCase() || 'MACEIO'
  const txid = sanitizeTxid(input.txid || 'ORCALY')
  const description = onlyAllowed(input.description || '', 72)

  const merchantInfo = [
    field('00', 'br.gov.bcb.pix'),
    field('01', key),
    description ? field('02', description) : '',
  ].join('')

  const amount = Number(input.amount || 0)
  const amountField = amount > 0 ? field('54', amount.toFixed(2)) : ''

  const payloadSemCrc = [
    field('00', '01'),
    field('26', merchantInfo),
    field('52', '0000'),
    field('53', '986'),
    amountField,
    field('58', 'BR'),
    field('59', merchantName),
    field('60', merchantCity),
    field('62', field('05', txid)),
    '6304',
  ].join('')

  return `${payloadSemCrc}${crc16(payloadSemCrc)}`
}
