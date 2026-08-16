import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let changed = 0;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
  changed += 1;
  console.log(`[PATCH] ${rel}`);
}

function patch(rel, transform) {
  const original = read(rel);
  const updated = transform(original);
  if (updated === original) {
    console.log(`[SKIP] ${rel}`);
    return;
  }
  write(rel, updated);
}

function replaceOnce(content, oldText, newText, label) {
  if (content.includes(newText)) return content;
  const first = content.indexOf(oldText);
  if (first < 0) throw new Error(`Padrao nao encontrado: ${label}`);
  if (content.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error(`Padrao ambiguo: ${label}`);
  }
  return content.replace(oldText, newText);
}

function replaceRegexOnce(content, regex, replacement, label) {
  const globalFlags = regex.flags.includes("g")
    ? regex.flags
    : `${regex.flags}g`;
  const probe = new RegExp(regex.source, globalFlags);
  const matches = [...content.matchAll(probe)];

  if (matches.length === 0) {
    if (typeof replacement === "string" && content.includes(replacement)) return content;
    throw new Error(`Regex nao encontrado: ${label}`);
  }

  if (matches.length !== 1) {
    throw new Error(`Regex ambiguo (${matches.length}): ${label}`);
  }

  return content.replace(regex, replacement);
}

// 1) ESLint: ignore only generated/local artifacts. Production source remains strict.
patch("eslint.config.mjs", (content) => {
  if (content.includes('"pacote-*/**"')) return content;
  return replaceOnce(
    content,
    '    ".orcaly-backups/**",\n',
    '    ".orcaly-backups/**",\n' +
      '    ".orcaly-*/**",\n' +
      '    "pacote-*/**",\n' +
      '    "orcaly-payment-flows-phase1/**",\n' +
      '    "orcaly-payment-flows-phase1.mjs",\n' +
      '    "orcaly-payment-flows-phase1.zip",\n',
    "eslint local artifacts",
  );
});

// 2) Public proposal page: type the loose structures and schedule initial load.
patch("app/proposta/[token]/page.tsx", (content) => {
  content = replaceOnce(
    content,
    "import { useEffect, useMemo, useState } from 'react'",
    "import { useCallback, useEffect, useMemo, useState } from 'react'",
    "proposal useCallback import",
  );

  content = content.replace(
    "respostas?: Record<string, any>",
    "respostas?: Record<string, unknown>",
  );

  if (!content.includes("type ProposalEvent = {")) {
    content = replaceOnce(
      content,
      "type Empresa = {\n",
      "type ProposalEvent = {\n" +
        "  id: string\n" +
        "  event_type: string\n" +
        "  created_at: string\n" +
        "  note?: string | null\n" +
        "}\n\n" +
        "type Empresa = {\n",
      "proposal event type",
    );
  }

  content = content.replace(
    "const [config, setConfig] = useState<any>({})",
    "const [config, setConfig] = useState<Record<string, unknown>>({})",
  );
  content = content.replace(
    "const [events, setEvents] = useState<any[]>([])",
    "const [events, setEvents] = useState<ProposalEvent[]>([])",
  );

  if (!content.includes("const carregar = useCallback(async () => {")) {
    content = replaceOnce(
      content,
      "  async function carregar() {\n    setCarregando(true)\n",
      "  const carregar = useCallback(async () => {\n" +
        "    if (!token) return\n" +
        "    setCarregando(true)\n",
      "proposal load callback start",
    );

    content = replaceOnce(
      content,
      "    setCarregando(false)\n  }\n\n  useEffect(() => {\n    if (token) carregar()\n  }, [token])",
      "    setCarregando(false)\n" +
        "  }, [token])\n\n" +
        "  useEffect(() => {\n" +
        "    if (!token) return\n\n" +
        "    const timer = window.setTimeout(() => {\n" +
        "      void carregar()\n" +
        "    }, 0)\n\n" +
        "    return () => window.clearTimeout(timer)\n" +
        "  }, [carregar, token])",
      "proposal load callback end/effect",
    );
  }

  content = content.replace(
    "setAba(id as any)",
    "setAba(id as 'aprovar' | 'alteracao' | 'recusar')",
  );

  return content;
});

// 3) Owner control center: initial async load should not synchronously cascade from effect.
patch("components/admin/OwnerControlCenter.tsx", (content) => {
  const oldBlock =
`  useEffect(() => {
    void load();
  }, [load]);`;
  const newBlock =
`  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);`;
  return replaceOnce(content, oldBlock, newBlock, "owner initial load effect");
});

// 4) Checkout: defer session restore setters and null-total reset.
patch("components/checkout/CheckoutClient.tsx", (content) => {
  if (!content.includes("const restoreTimer = window.setTimeout(() => {")) {
    content = replaceOnce(
      content,
      `  useEffect(() => {
    if (!data) return;

    const key = \`orcaly-checkout:\${slug}\`;`,
      `  useEffect(() => {
    if (!data) return;

    const restoreTimer = window.setTimeout(() => {
    const key = \`orcaly-checkout:\${slug}\`;`,
      "checkout restore effect start",
    );

    content = replaceOnce(
      content,
      `    } catch {
      window.sessionStorage.removeItem(key);
    }
  }, [data, slug]);`,
      `    } catch {
      window.sessionStorage.removeItem(key);
    }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [data, slug]);`,
      "checkout restore effect end",
    );
  }

  content = replaceOnce(
    content,
    `    if (!data || cart.length === 0) {
      setPreparedTotal(null);
      return;
    }`,
    `    if (!data || cart.length === 0) {
      const resetTimer = window.setTimeout(() => {
        setPreparedTotal(null);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }`,
    "checkout prepared total reset",
  );

  return content;
});

// 5) Finance: schedule initial load and mode-reset updates.
patch("components/financeiro/FinancialAreaClient.tsx", (content) => {
  content = replaceOnce(
    content,
    `  useEffect(() => {
    void loadData()
  }, [])`,
    `  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])`,
    "finance initial load effect",
  );

  content = replaceOnce(
    content,
    `  useEffect(() => {
    setForm(defaultForm(mode))
    setDocumentFile(null)
    setShowForm(false)
    setQuery('')
    setStatusFilter('todos')
  }, [mode])`,
    `  useEffect(() => {
    const timer = window.setTimeout(() => {
      setForm(defaultForm(mode))
      setDocumentFile(null)
      setShowForm(false)
      setQuery('')
      setStatusFilter('todos')
    }, 0)

    return () => window.clearTimeout(timer)
  }, [mode])`,
    "finance mode reset effect",
  );

  return content;
});

// 6) Home AI chat: restore/local UI state from timer callbacks, not effect body.
patch("components/home/HomeAiChat.tsx", (content) => {
  content = replaceOnce(
    content,
    `  useEffect(() => {
    setMessages(restoreMessages())
    setHydrated(true)
  }, [])`,
    `  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMessages(restoreMessages())
      setHydrated(true)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])`,
    "home chat hydration effect",
  );

  content = replaceOnce(
    content,
    `  useEffect(() => {
    if (!open) return

    setUnread(false)

    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 180)

    return () => window.clearTimeout(timer)
  }, [open])`,
    `  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      setUnread(false)
      inputRef.current?.focus()
    }, 180)

    return () => window.clearTimeout(timer)
  }, [open])`,
    "home chat open effect",
  );

  return content;
});

// 7) Subscription manager: stable clock + deferred load.
patch("components/subscription/SubscriptionManager.tsx", (content) => {
  if (!content.includes("const [currentTimestamp, setCurrentTimestamp] = useState(0);")) {
    content = replaceOnce(
      content,
      `  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");`,
      `  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [currentTimestamp, setCurrentTimestamp] = useState(0);`,
      "subscription clock state",
    );
  }

  content = replaceOnce(
    content,
    `  useEffect(() => {
    void load();
  }, [load]);`,
    `  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);

    const refreshClock = () => {
      setCurrentTimestamp(new Date().getTime());
    };

    const clockTimer = window.setTimeout(refreshClock, 0);
    const clockInterval = window.setInterval(refreshClock, 60_000);

    return () => {
      window.clearTimeout(loadTimer);
      window.clearTimeout(clockTimer);
      window.clearInterval(clockInterval);
    };
  }, [load]);`,
    "subscription load and clock effect",
  );

  content = replaceRegexOnce(
    content,
    /  const trialProgress = useMemo\(\(\) => \{\n    if \(!company\?\.trial_started_at \|\| !company\?\.trial_ends_at\) return 0;\n    const start = new Date\(company\.trial_started_at\)\.getTime\(\);\n    const end = new Date\(company\.trial_ends_at\)\.getTime\(\);\n    const total = Math\.max\(1, end - start\);\n    const elapsed = Math\.min\(total, Math\.max\(0, Date\.now\(\) - start\)\);\n    return Math\.round\(\(elapsed \/ total\) \* 100\);\n  \}, \[company\?\.trial_ends_at, company\?\.trial_started_at\]\);/,
    `  const trialProgress = (() => {
    if (
      !company?.trial_started_at ||
      !company?.trial_ends_at ||
      currentTimestamp <= 0
    ) {
      return 0;
    }

    const start = new Date(company.trial_started_at).getTime();
    const end = new Date(company.trial_ends_at).getTime();
    const total = Math.max(1, end - start);
    const elapsed = Math.min(
      total,
      Math.max(0, currentTimestamp - start),
    );

    return Math.round((elapsed / total) * 100);
  })();`,
    "subscription trial progress purity",
  );

  // Remove useMemo from this import only when no other useMemo calls remain.
  const remainingUses = (content.match(/\buseMemo\s*\(/g) || []).length;
  if (remainingUses === 0) {
    content = content.replace(
      "import { useCallback, useEffect, useMemo, useState } from \"react\";",
      "import { useCallback, useEffect, useState } from \"react\";",
    );
  }

  return content;
});

console.log(`V7_PATCH_CHANGED=${changed}`);
console.log("ORCALY_V7_PATCH_OK=1");
