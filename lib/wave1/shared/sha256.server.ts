// Server-only adapter: SHA-256 HashFn backed by node:crypto.
// Never import this file from lib/**/core/** — inject the function instead.

import { createHash } from 'node:crypto'
import type { HashFn } from './canonical'

export const sha256Hex: HashFn = (input) => createHash('sha256').update(input, 'utf8').digest('hex')
