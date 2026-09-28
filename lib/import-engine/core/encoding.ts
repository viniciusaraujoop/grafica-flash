// Encoding & binary safety (§7, preflight §7). UTF-8 ONLY; fatal decoding; no guessing.
// Byte limit is checked BEFORE decoding (preflight §36 D).

import { IMPORT_LIMITS } from './types'

export type DecodedInput =
  | { ok: true; text: string; byteLength: number; hadBom: boolean; bytes: Uint8Array }
  | { ok: false; code: 'CSV_INPUT_TOO_LARGE' | 'CSV_INVALID_UTF8' | 'CSV_NUL_BYTE' | 'CSV_BINARY_CONTENT' | 'CSV_EMPTY' | 'CSV_ENCODING_UNSUPPORTED'; byteLength: number }

/** Forbidden controls: U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F. TAB/CR/LF allowed. */
function isForbiddenControl(code: number): boolean {
  return code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f) || code === 0x7f
}

/** UTF-8 byte length of a JS string without allocating; null when it contains a lone surrogate. */
export function utf8ByteLength(text: string): number | null {
  let bytes = 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return null
      bytes += 4
      i += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) return null
    else bytes += 3
  }
  return bytes
}

/** Code point count (Unicode characters), not UTF-16 units. */
export function codePointLength(text: string): number {
  let count = 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) i += 1
    count += 1
  }
  return count
}

function scanControls(text: string): 'CSV_NUL_BYTE' | 'CSV_BINARY_CONTENT' | null {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code === 0) return 'CSV_NUL_BYTE'
    if (isForbiddenControl(code)) return 'CSV_BINARY_CONTENT'
  }
  return null
}

const encoder = new TextEncoder()

/**
 * Accepts raw bytes (preferred: fatal UTF-8 decoding here) or a string whose caller guarantees it was
 * already decoded as UTF-8. Any other input type → CSV_ENCODING_UNSUPPORTED. BOM is removed from the
 * decoded text but kept in `bytes` (the input fingerprint hashes the exact original bytes).
 */
export function decodeCsvInput(input: unknown): DecodedInput {
  let bytes: Uint8Array
  let text: string
  if (input instanceof Uint8Array) {
    bytes = input
    if (bytes.length > IMPORT_LIMITS.maxInputBytes) return { ok: false, code: 'CSV_INPUT_TOO_LARGE', byteLength: bytes.length }
    for (let i = 0; i < bytes.length; i += 1) if (bytes[i] === 0) return { ok: false, code: 'CSV_NUL_BYTE', byteLength: bytes.length }
    try {
      // ignoreBOM: true keeps the BOM in the text so its presence is reported and stripped exactly once below.
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    } catch {
      return { ok: false, code: 'CSV_INVALID_UTF8', byteLength: bytes.length }
    }
  } else if (typeof input === 'string') {
    const length = utf8ByteLength(input)
    if (length === null) return { ok: false, code: 'CSV_INVALID_UTF8', byteLength: 0 }
    if (length > IMPORT_LIMITS.maxInputBytes) return { ok: false, code: 'CSV_INPUT_TOO_LARGE', byteLength: length }
    text = input
    bytes = encoder.encode(input)
  } else {
    return { ok: false, code: 'CSV_ENCODING_UNSUPPORTED', byteLength: 0 }
  }

  const control = scanControls(text)
  if (control) return { ok: false, code: control, byteLength: bytes.length }
  const hadBom = text.charCodeAt(0) === 0xfeff
  if (hadBom) text = text.slice(1)
  if (text.length === 0) return { ok: false, code: 'CSV_EMPTY', byteLength: bytes.length }
  return { ok: true, text, byteLength: bytes.length, hadBom, bytes }
}
