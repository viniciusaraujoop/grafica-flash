// Bounded diagnostics (§6, preflight §26): at most N issue objects are retained; aggregate
// counters keep counting after the cap and `truncated` is set. Output order is canonical.

import type { ImportIssue, IssueCode, IssueSeverity } from './types'

export class BoundedIssues {
  private readonly retained: ImportIssue[] = []
  private readonly counts = new Map<IssueCode, number>()
  private errorTotal = 0
  private warningTotal = 0
  private readonly cap: number
  truncated = false

  constructor(cap: number) {
    this.cap = cap
  }

  add(code: IssueCode, severity: IssueSeverity, rowNumber: number | null, columnId: string | null, params?: Record<string, string | number>): void {
    this.counts.set(code, (this.counts.get(code) ?? 0) + 1)
    if (severity === 'error') this.errorTotal += 1
    else this.warningTotal += 1
    if (this.retained.length >= this.cap) {
      this.truncated = true
      return
    }
    this.retained.push(params ? { code, severity, rowNumber, columnId, params } : { code, severity, rowNumber, columnId })
  }

  get errors(): number {
    return this.errorTotal
  }

  get warnings(): number {
    return this.warningTotal
  }

  count(code: IssueCode): number {
    return this.counts.get(code) ?? 0
  }

  /** Stable order: file-level first, then by row, column, code (code-unit comparison, never locale). */
  list(): ImportIssue[] {
    return this.retained
      .map((issue, index) => ({ issue, index }))
      .sort((a, b) => {
        const ra = a.issue.rowNumber ?? 0
        const rb = b.issue.rowNumber ?? 0
        if (ra !== rb) return ra - rb
        const ca = a.issue.columnId ?? ''
        const cb = b.issue.columnId ?? ''
        if (ca !== cb) return ca < cb ? -1 : 1
        if (a.issue.code !== b.issue.code) return a.issue.code < b.issue.code ? -1 : 1
        return a.index - b.index
      })
      .map((entry) => entry.issue)
  }

  /** Aggregate counters by code, keys in code-unit order. */
  totals(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const code of [...this.counts.keys()].sort()) out[code] = this.counts.get(code) as number
    return out
  }
}
