// Wave 1 pure core: shared result model. No I/O, safe for server and browser.

export type IssueSeverity = 'error' | 'warning'

export type ValidationIssue = {
  code: string
  path: string
  severity: IssueSeverity
  params?: Record<string, string | number>
}

export type Result<T> =
  | { ok: true; value: T; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[]; warnings: ValidationIssue[] }

export function issue(
  code: string,
  path: string,
  params?: Record<string, string | number>,
  severity: IssueSeverity = 'error',
): ValidationIssue {
  return params ? { code, path, severity, params } : { code, path, severity }
}

export function ok<T>(value: T, warnings: ValidationIssue[] = []): Result<T> {
  return { ok: true, value, warnings }
}

export function fail<T>(errors: ValidationIssue[], warnings: ValidationIssue[] = []): Result<T> {
  return { ok: false, errors, warnings }
}

/** Splits collected issues into a Result; any error makes it a failure. */
export function fromIssues<T>(value: T, issues: ValidationIssue[]): Result<T> {
  const errors = issues.filter((item) => item.severity === 'error')
  const warnings = issues.filter((item) => item.severity === 'warning')
  return errors.length ? fail(errors, warnings) : ok(value, warnings)
}
