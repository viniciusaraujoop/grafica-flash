import { readFile, writeFile } from 'node:fs/promises'

const file = 'app/login/page.tsx'
let source = await readFile(file, 'utf8')

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search)
  if (first < 0) throw new Error(`Patch ${label}: trecho não encontrado.`)
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Patch ${label}: trecho apareceu mais de uma vez.`)
  }
  source = source.slice(0, first) + replacement + source.slice(first + search.length)
}

replaceOnce(
  `import {\n  useEffect,\n  useMemo,\n  useState,\n  type FormEvent,\n  type ReactNode,\n} from 'react'\nimport { signInWithPasswordAction } from './actions'`,
  `import {\n  useActionState,\n  useEffect,\n  useMemo,\n  useState,\n  type ReactNode,\n} from 'react'\nimport { signInWithPasswordFormAction } from './actions'`,
  'imports',
)

replaceOnce(
  `  const [lembrarEmail, setLembrarEmail] = useState(true)\n  const [carregando, setCarregando] = useState(false)\n  const [mensagem, setMensagem] = useState(`,
  `  const [lembrarEmail, setLembrarEmail] = useState(true)\n  const [nextPath, setNextPath] = useState('/painel/inicio')\n  const [loginState, loginAction, carregando] = useActionState(\n    signInWithPasswordFormAction,\n    { ok: false, error: '' },\n  )\n  const [mensagem, setMensagem] = useState(`,
  'action-state',
)

replaceOnce(
  `    const params = new URLSearchParams(window.location.search)\n\n    const frame = window.requestAnimationFrame(() => {`,
  `    const params = new URLSearchParams(window.location.search)\n    setNextPath(getSafeNextPath())\n\n    const frame = window.requestAnimationFrame(() => {`,
  'next-path',
)

replaceOnce(
  `  useEffect(() => {\n    const timer = window.setInterval(() => {`,
  `  useEffect(() => {\n    if (!loginState.error) return\n\n    setTipoMensagem('erro')\n    setMensagem(loginState.error)\n  }, [loginState.error])\n\n  useEffect(() => {\n    const timer = window.setInterval(() => {`,
  'server-error-state',
)

replaceOnce(
  `  async function entrar(\n    evento: FormEvent<HTMLFormElement>,\n  ) {\n    evento.preventDefault()\n\n    if (carregando) return\n\n    const emailLimpo = email.trim().toLowerCase()\n\n    if (!emailLimpo) {\n      setTipoMensagem('erro')\n      setMensagem('Informe o e-mail da conta.')\n      return\n    }\n\n    if (!emailValido) {\n      setTipoMensagem('erro')\n      setMensagem('Digite um e-mail válido.')\n      return\n    }\n\n    if (!senha) {\n      setTipoMensagem('erro')\n      setMensagem('Informe sua senha de acesso.')\n      return\n    }\n\n    setCarregando(true)\n    setTipoMensagem('info')\n    setMensagem('Validando seu acesso...')\n\n    if (\n      lembrarEmail &&\n      typeof window !== 'undefined'\n    ) {\n      window.localStorage.setItem(\n        'orcaly_login_email',\n        emailLimpo,\n      )\n    }\n\n    try {\n      setTipoMensagem('sucesso')\n      setMensagem('Acesso validado. Preparando seu painel...')\n\n      const result = await signInWithPasswordAction({\n        email: emailLimpo,\n        password: senha,\n        next: getSafeNextPath(),\n      })\n\n      setTipoMensagem('erro')\n      setMensagem(result.error)\n      setCarregando(false)\n    } catch {\n      setTipoMensagem('erro')\n      setMensagem(\n        'Não foi possível entrar agora. Tente novamente em alguns instantes.',\n      )\n      setCarregando(false)\n    }\n  }\n\n`,
  ``,
  'legacy-client-submit',
)

replaceOnce(
  `            <form\n              onSubmit={entrar}\n              className="relative overflow-hidden rounded-[2.1rem] border border-white bg-white p-5 shadow-[0_35px_100px_rgba(6,26,54,.16)] sm:p-8"\n            >`,
  `            <form\n              action={loginAction}\n              className="relative overflow-hidden rounded-[2.1rem] border border-white bg-white p-5 shadow-[0_35px_100px_rgba(6,26,54,.16)] sm:p-8"\n            >\n              <input type="hidden" name="next" value={nextPath} />`,
  'form-action',
)

replaceOnce(
  `                      <input\n                        value={email}`,
  `                      <input\n                        name="email"\n                        required\n                        value={email}`,
  'email-field',
)

replaceOnce(
  `                      <input\n                        value={senha}`,
  `                      <input\n                        name="password"\n                        required\n                        value={senha}`,
  'password-field',
)

if (source.includes('onSubmit={entrar}')) throw new Error('Patch incompleto: onSubmit legado ainda existe.')
if (source.includes('signInWithPasswordAction')) throw new Error('Patch incompleto: action cliente legada ainda importada/usada.')
if (!source.includes('action={loginAction}')) throw new Error('Patch incompleto: form não usa Server Action.')
if (!source.includes('name="email"') || !source.includes('name="password"')) {
  throw new Error('Patch incompleto: campos sem nomes para FormData.')
}

await writeFile(file, source)
console.log('Login progressive enhancement patch applied safely.')
