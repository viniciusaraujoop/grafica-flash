const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app', 'login', 'page.tsx');

if (!fs.existsSync(file)) {
  throw new Error(`Arquivo nao encontrado: ${file}`);
}

const source = fs.readFileSync(file, 'utf8');

const pattern = /  useEffect\(\(\) => \{\r?\n    if \(typeof window === 'undefined'\) return\r?\n\r?\n    const savedEmail = window\.localStorage\.getItem\(\r?\n      'orcaly_login_email',\r?\n    \)\r?\n\r?\n    if \(savedEmail\) \{\r?\n      setEmail\(savedEmail\)\r?\n    \}\r?\n\r?\n    const params = new URLSearchParams\(window\.location\.search\)\r?\n\r?\n    if \(params\.get\('expired'\) === '1'\) \{\r?\n      setTipoMensagem\('info'\)\r?\n      setMensagem\(\r?\n        'Sua sessão expirou\. Entre novamente para continuar\.',\r?\n      \)\r?\n      return\r?\n    \}\r?\n\r?\n    if \(params\.get\('renovar'\) === '1'\) \{\r?\n      setTipoMensagem\('info'\)\r?\n      setMensagem\(\r?\n        'Entre para renovar sua assinatura e reativar seu painel\.',\r?\n      \)\r?\n      return\r?\n    \}\r?\n\r?\n    setTipoMensagem\('info'\)\r?\n    setMensagem\(\r?\n      'Entre para acessar o painel da sua empresa\.',\r?\n    \)\r?\n  \}, \[\]\)/g;

const matches = [...source.matchAll(pattern)];

if (matches.length !== 1) {
  throw new Error(
    `Esperava encontrar exatamente 1 useEffect de inicializacao, mas encontrei ${matches.length}.`,
  );
}

const eol = source.includes('\r\n') ? '\r\n' : '\n';

const replacement = [
  "  useEffect(() => {",
  "    if (typeof window === 'undefined') return",
  "",
  "    const savedEmail = window.localStorage.getItem(",
  "      'orcaly_login_email',",
  "    )",
  "    const params = new URLSearchParams(window.location.search)",
  "",
  "    const frame = window.requestAnimationFrame(() => {",
  "      if (savedEmail) {",
  "        setEmail(savedEmail)",
  "      }",
  "",
  "      if (params.get('expired') === '1') {",
  "        setTipoMensagem('info')",
  "        setMensagem(",
  "          'Sua sessão expirou. Entre novamente para continuar.',",
  "        )",
  "        return",
  "      }",
  "",
  "      if (params.get('renovar') === '1') {",
  "        setTipoMensagem('info')",
  "        setMensagem(",
  "          'Entre para renovar sua assinatura e reativar seu painel.',",
  "        )",
  "        return",
  "      }",
  "",
  "      setTipoMensagem('info')",
  "      setMensagem(",
  "        'Entre para acessar o painel da sua empresa.',",
  "      )",
  "    })",
  "",
  "    return () => window.cancelAnimationFrame(frame)",
  "  }, [])",
].join(eol);

const updated = source.replace(pattern, replacement);

if (updated === source) {
  throw new Error('Nenhuma alteracao foi aplicada.');
}

fs.writeFileSync(file, updated, 'utf8');

console.log('LOGIN_EFFECT_LINT_FIX_APPLIED=1');
