const fs = require('fs');
const path = require('path');

const root = process.cwd();
const headerFile = path.join(root, 'components', 'painel', 'PanelPremiumHeader.tsx');
const layoutFile = path.join(root, 'app', 'painel', 'layout.tsx');

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo nao encontrado: ${file}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first === -1) {
    if (source.includes(replacement)) {
      console.log(`[OK] ${label} ja aplicado`);
      return source;
    }
    throw new Error(`Trecho nao encontrado para: ${label}`);
  }

  const second = source.indexOf(search, first + search.length);
  if (second !== -1) {
    throw new Error(`Mais de uma ocorrencia encontrada para: ${label}`);
  }

  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

let header = read(headerFile);

header = replaceOnce(
  header,
  "import Link from 'next/link'\n",
  "import Link from 'next/link'\nimport { supabase } from '@/lib/supabase'\n",
  'import do Supabase no header',
);

header = replaceOnce(
  header,
  "  const parts = pathname.split('/').filter(Boolean).slice(1)\n\n  return (\n",
  "  const parts = pathname.split('/').filter(Boolean).slice(1)\n\n  async function logout() {\n    await supabase.auth.signOut()\n    window.location.assign('/login')\n  }\n\n  return (\n",
  'funcao logout no header',
);

header = replaceOnce(
  header,
  "        {publicUrl ? (\n          <Link href={publicUrl} target=\"_blank\" rel=\"noreferrer\" className=\"panel-adaptive-open-site\">\n            Abrir site\n            <span aria-hidden=\"true\">&#8599;</span>\n          </Link>\n        ) : null}\n      </div>\n",
  "        {publicUrl ? (\n          <Link href={publicUrl} target=\"_blank\" rel=\"noreferrer\" className=\"panel-adaptive-open-site\">\n            Abrir site\n            <span aria-hidden=\"true\">&#8599;</span>\n          </Link>\n        ) : null}\n\n        <button\n          type=\"button\"\n          onClick={() => void logout()}\n          className=\"inline-flex min-h-[2.9rem] items-center justify-center rounded-[0.95rem] border border-red-100 bg-white px-4 py-3 text-xs font-black text-red-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-red-50\"\n          aria-label=\"Sair da conta\"\n          title=\"Sair da conta\"\n        >\n          Sair\n        </button>\n      </div>\n",
  'botao sair no painel principal',
);

fs.writeFileSync(headerFile, header, 'utf8');

let layout = read(layoutFile);

layout = replaceOnce(
  layout,
  "              <button\n                type=\"button\"\n                onClick={() => window.location.reload()}\n                className=\"inline-flex items-center justify-center rounded-2xl border border-blue-100 bg-white px-6 py-4 text-center font-black text-[#05245c] transition hover:-translate-y-0.5\"\n              >\n                J\u00e1 paguei, verificar acesso\n              </button>\n            </div>\n",
  "              <button\n                type=\"button\"\n                onClick={() => window.location.reload()}\n                className=\"inline-flex items-center justify-center rounded-2xl border border-blue-100 bg-white px-6 py-4 text-center font-black text-[#05245c] transition hover:-translate-y-0.5\"\n              >\n                J\u00e1 paguei, verificar acesso\n              </button>\n\n              <button\n                type=\"button\"\n                onClick={async () => {\n                  await supabase.auth.signOut()\n                  window.location.assign('/login')\n                }}\n                className=\"inline-flex items-center justify-center rounded-2xl border border-red-100 bg-white px-6 py-4 text-center font-black text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50\"\n              >\n                Sair\n              </button>\n            </div>\n",
  'botao sair no painel bloqueado',
);

fs.writeFileSync(layoutFile, layout, 'utf8');

console.log('');
console.log('ORCALY_LOGOUT_BUTTONS_APPLIED=1');
console.log('PANEL_MAIN_LOGOUT=1');
console.log('PANEL_BLOCKED_LOGOUT=1');
console.log('PARTNER_LOGOUT_ALREADY_EXISTS=1');
