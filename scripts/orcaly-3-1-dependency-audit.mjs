import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
const rootDependencies = {
  ...(lock.packages?.['']?.dependencies || {}),
  ...(lock.packages?.['']?.devDependencies || {}),
}
const gate = process.argv.includes('--gate')

function runAudit(extraArgs = []) {
  const result = spawnSync('npm', ['audit', '--json', ...extraArgs], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  const raw = String(result.stdout || '').trim()
  if (!raw) {
    return {
      ok: false,
      error: String(result.stderr || 'npm audit returned no JSON').replace(/\s+/g, ' ').trim().slice(0, 300),
      summary: null,
      vulnerabilities: [],
    }
  }

  try {
    const parsed = JSON.parse(raw)
    const vulnerabilities = Object.entries(parsed.vulnerabilities || {}).map(([name, item]) => {
      const node = Array.isArray(item.nodes) ? item.nodes[0] : null
      const installed = node && lock.packages?.[node]?.version ? lock.packages[node].version : null
      const advisories = (Array.isArray(item.via) ? item.via : [])
        .filter((via) => via && typeof via === 'object')
        .map((via) => ({
          source: via.source || null,
          title: via.title || null,
          severity: via.severity || null,
          range: via.range || null,
          url: via.url || null,
        }))
      const fix = item.fixAvailable
      return {
        package: name,
        installed,
        severity: item.severity || null,
        vulnerableRange: item.range || null,
        direct: Boolean(item.isDirect || Object.hasOwn(rootDependencies, name)),
        nodes: Array.isArray(item.nodes) ? item.nodes.slice(0, 6) : [],
        effects: Array.isArray(item.effects) ? item.effects.slice(0, 10) : [],
        advisories,
        fixAvailable: fix === true
          ? { available: true, name: null, version: null, major: null }
          : fix && typeof fix === 'object'
            ? { available: true, name: fix.name || null, version: fix.version || null, major: Boolean(fix.isSemVerMajor) }
            : { available: false, name: null, version: null, major: null },
      }
    })

    return {
      ok: true,
      error: null,
      summary: parsed.metadata?.vulnerabilities || null,
      vulnerabilities,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not parse npm audit JSON',
      summary: null,
      vulnerabilities: [],
    }
  }
}

function printAudit(label, audit) {
  console.log(`ORCALY_DEP_AUDIT_${label}_SUMMARY`, JSON.stringify({ ok: audit.ok, error: audit.error, summary: audit.summary }))
  for (const vulnerability of audit.vulnerabilities) {
    console.log(`ORCALY_DEP_AUDIT_${label}_PACKAGE`, JSON.stringify(vulnerability))
  }
}

function highOrCriticalCount(audit) {
  return Number(audit.summary?.high || 0) + Number(audit.summary?.critical || 0)
}

const full = runAudit()
const runtime = runAudit(['--omit=dev'])
printAudit('FULL', full)
printAudit('RUNTIME', runtime)

if (gate && (!full.ok || !runtime.ok || highOrCriticalCount(runtime) > 0)) {
  console.error('ORCALY_DEP_AUDIT_GATE_FAIL', JSON.stringify({
    fullOk: full.ok,
    runtimeOk: runtime.ok,
    runtimeHighOrCritical: highOrCriticalCount(runtime),
  }))
  process.exit(1)
}

if (gate) {
  console.log('ORCALY_DEP_AUDIT_GATE_PASS')
}
