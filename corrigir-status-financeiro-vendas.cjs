const fs = require('fs');
const path = require('path');

// ORCALY_FINANCE_STATUS_FIX_V1

const root = process.cwd();

const targets = [
  {
    rel: 'lib/payments/checkout-service.ts',
    search: '          status: "recebido",',
    replacement: '          status: "pago",',
    label: 'status financeiro das novas vendas',
  },
  {
    rel: 'scripts/backfill-marketplace-finance-tracking.sql',
    search: "  'recebido',",
    replacement: "  'pago',",
    label: 'status financeiro do backfill',
  },
];

const prepared = [];

for (const target of targets) {
  const file = path.join(root, target.rel);

  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo nao encontrado: ${target.rel}`);
  }

  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const text = raw.replace(/\r\n/g, '\n');

  const first = text.indexOf(target.search);

  if (first === -1) {
    if (text.includes(target.replacement)) {
      prepared.push({
        ...target,
        file,
        eol,
        text,
        changed: false,
      });
      continue;
    }

    throw new Error(
      `Trecho nao encontrado: ${target.label}`,
    );
  }

  const second = text.indexOf(
    target.search,
    first + target.search.length,
  );

  if (second !== -1) {
    throw new Error(
      `Mais de uma ocorrencia encontrada: ${target.label}`,
    );
  }

  prepared.push({
    ...target,
    file,
    eol,
    text:
      text.slice(0, first) +
      target.replacement +
      text.slice(first + target.search.length),
    changed: true,
  });
}

// Valida tudo antes de salvar.
for (const item of prepared) {
  if (!item.text.includes(item.replacement)) {
    throw new Error(
      `Validacao final falhou: ${item.label}`,
    );
  }
}

// So agora grava.
for (const item of prepared) {
  if (!item.changed) {
    console.log(`[OK JA CORRIGIDO] ${item.rel}`);
    continue;
  }

  const output =
    item.eol === '\r\n'
      ? item.text.replace(/\n/g, '\r\n')
      : item.text;

  fs.writeFileSync(item.file, output, 'utf8');
  console.log(`[ALTERADO] ${item.rel}`);
}

console.log('');
console.log('ORCALY_FINANCE_STATUS_FIX_OK=1');
console.log('NEW_SALES_STATUS_PAGO=1');
console.log('BACKFILL_STATUS_PAGO=1');
