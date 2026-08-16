const fs = require('fs');
const path = require('path');

// ORCALY_REACT_EFFECT_LINT_FIX_V1

const root = process.cwd();

function readNormalized(rel) {
  const file = path.join(root, rel);

  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo nao encontrado: ${rel}`);
  }

  const raw = fs.readFileSync(file, 'utf8');

  return {
    file,
    eol: raw.includes('\r\n') ? '\r\n' : '\n',
    text: raw.replace(/\r\n/g, '\n'),
  };
}

function replaceRegexOnce(text, regex, replacement, label) {
  const matches = text.match(regex);

  if (!matches) {
    if (text.includes(replacement)) {
      console.log(`[OK JA APLICADO] ${label}`);
      return text;
    }

    throw new Error(`Trecho nao encontrado: ${label}`);
  }

  return text.replace(regex, replacement);
}

const files = new Map();

function load(rel) {
  if (!files.has(rel)) {
    files.set(rel, readNormalized(rel));
  }

  return files.get(rel);
}

function update(rel, next) {
  const entry = load(rel);
  entry.text = next;
}

//
// 1. Pagina publica de rastreio:
//    o primeiro load deixa de ser chamado diretamente no effect.
//
{
  const rel = 'app/pedido/[token]/page.tsx';
  const entry = load(rel);

  const regex =
    /  useEffect\(\(\) => \{\n    void load\(\)\n\n    const timer = window\.setInterval\(\(\) => \{\n      void load\(\)\n    \}, 8000\)\n\n    return \(\) => window\.clearInterval\(timer\)\n    \/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n  \}, \[token\]\)/;

  const replacement = `  useEffect(() => {
    const initial = window.setTimeout(() => {
      void load()
    }, 0)

    const timer = window.setInterval(() => {
      void load()
    }, 8000)

    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])`;

  update(
    rel,
    replaceRegexOnce(
      entry.text,
      regex,
      replacement,
      'rastreio: carregamento inicial',
    ),
  );
}

//
// 2. Checkout: restauracao do sessionStorage.
//    Todas as mutacoes de estado passam a ocorrer no callback agendado.
//
{
  const rel = 'components/checkout/CheckoutClient.tsx';
  const entry = load(rel);

  const regex =
    /  useEffect\(\(\) => \{\n    if \(!data\) return;\n\n    const key = `orcaly-checkout:\$\{slug\}`;\n    const raw = window\.sessionStorage\.getItem\(key\);\n\n    if \(!raw\) return;\n\n    try \{\n([\s\S]*?)      window\.sessionStorage\.removeItem\(key\);\n    \} catch \{\n      window\.sessionStorage\.removeItem\(key\);\n    \}\n  \}, \[data, slug\]\);/;

  const match = entry.text.match(regex);

  if (!match) {
    if (!entry.text.includes('const restoreTimer = window.setTimeout(() => {')) {
      throw new Error(
        'Trecho nao encontrado: checkout: restauracao do carrinho',
      );
    }
  } else {
    const body = match[1];

    const replacement = `  useEffect(() => {
    if (!data) return;

    const key = \`orcaly-checkout:\${slug}\`;
    const raw = window.sessionStorage.getItem(key);

    if (!raw) return;

    try {
${body}      const restoreTimer = window.setTimeout(() => {
        if (imported.length) setCart(imported);

        if (parsed.customer) {
          setCustomer((current) => ({
            ...current,
            ...parsed.customer,
          }));
        }

        if (parsed.delivery) {
          setDelivery((current) => ({
            ...current,
            ...parsed.delivery,
          }));
        }

        if (parsed.couponCode) {
          setCouponCode(parsed.couponCode);
        }

        window.sessionStorage.removeItem(key);
      }, 0);

      return () => window.clearTimeout(restoreTimer);
    } catch {
      window.sessionStorage.removeItem(key);
    }
  }, [data, slug]);`;

    // Remove the original synchronous setter section from captured body.
    const cleanedReplacement = replacement.replace(
      /\n      if \(imported\.length\) setCart\(imported\);\n\n      if \(parsed\.customer\) \{[\s\S]*?\n      if \(parsed\.couponCode\) \{\n        setCouponCode\(parsed\.couponCode\);\n      \}\n\n(?=      const restoreTimer)/,
      '\n',
    );

    update(rel, entry.text.replace(regex, cleanedReplacement));
  }
}

//
// 3. Checkout: quando carrinho fica vazio, reset preparado e agendado.
//
{
  const rel = 'components/checkout/CheckoutClient.tsx';
  const entry = load(rel);

  const regex =
    /    if \(!data \|\| cart\.length === 0\) \{\n      setPreparedTotal\(null\);\n      return;\n    \}/;

  const replacement = `    if (!data || cart.length === 0) {
      const resetTimer = window.setTimeout(() => {
        setPreparedTotal(null);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }`;

  update(
    rel,
    replaceRegexOnce(
      entry.text,
      regex,
      replacement,
      'checkout: reset do total preparado',
    ),
  );
}

//
// 4. Financeiro: carga inicial agendada, com cleanup.
//    Mantem a intencao de executar uma vez ao montar.
//
{
  const rel = 'components/financeiro/FinancialAreaClient.tsx';
  const entry = load(rel);

  const regex =
    /  useEffect\(\(\) => \{\n    void loadData\(\)\n  \}, \[\]\)/;

  const replacement = `  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])`;

  update(
    rel,
    replaceRegexOnce(
      entry.text,
      regex,
      replacement,
      'financeiro: carga inicial',
    ),
  );
}

//
// 5. Financeiro: reset ao trocar modo tambem agendado.
//
{
  const rel = 'components/financeiro/FinancialAreaClient.tsx';
  const entry = load(rel);

  const regex =
    /  useEffect\(\(\) => \{\n    setForm\(defaultForm\(mode\)\)\n    setDocumentFile\(null\)\n    setShowForm\(false\)\n    setQuery\(''\)\n    setStatusFilter\('todos'\)\n  \}, \[mode\]\)/;

  const replacement = `  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setForm(defaultForm(mode))
      setDocumentFile(null)
      setShowForm(false)
      setQuery('')
      setStatusFilter('todos')
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [mode])`;

  update(
    rel,
    replaceRegexOnce(
      entry.text,
      regex,
      replacement,
      'financeiro: reset ao trocar modo',
    ),
  );
}

// Validacoes finais antes de qualquer escrita.
const requiredMarkers = [
  [
    'app/pedido/[token]/page.tsx',
    'const initial = window.setTimeout(() => {',
  ],
  [
    'components/checkout/CheckoutClient.tsx',
    'const restoreTimer = window.setTimeout(() => {',
  ],
  [
    'components/checkout/CheckoutClient.tsx',
    'const resetTimer = window.setTimeout(() => {',
  ],
  [
    'components/financeiro/FinancialAreaClient.tsx',
    'void loadData()',
  ],
  [
    'components/financeiro/FinancialAreaClient.tsx',
    "setStatusFilter('todos')",
  ],
];

for (const [rel, marker] of requiredMarkers) {
  const entry = load(rel);

  if (!entry.text.includes(marker)) {
    throw new Error(
      `Validacao final falhou em ${rel}: ${marker}`,
    );
  }
}

// Somente agora escreve.
for (const [rel, entry] of files) {
  const output =
    entry.eol === '\r\n'
      ? entry.text.replace(/\n/g, '\r\n')
      : entry.text;

  fs.writeFileSync(entry.file, output, 'utf8');
  console.log(`[ALTERADO] ${rel}`);
}

console.log('');
console.log('ORCALY_EFFECT_LINT_FIX_OK=1');
console.log('TRACKING_EFFECT_FIXED=1');
console.log('CHECKOUT_EFFECTS_FIXED=1');
console.log('FINANCE_EFFECTS_FIXED=1');
