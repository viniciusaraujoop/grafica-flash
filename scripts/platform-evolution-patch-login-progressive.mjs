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
  `  useMemo,\n  useState,\n  type ReactNode,`,
  `  useMemo,\n  useRef,\n  useState,\n  type ReactNode,`,
  'use-ref-import',
)

replaceOnce(
  `  const [lembrarEmail, setLembrarEmail] = useState(true)\n  const [nextPath, setNextPath] = useState('/painel/inicio')\n  const [loginState, loginAction, carregando] = useActionState(`,
  `  const [lembrarEmail, setLembrarEmail] = useState(true)\n  const nextPathRef = useRef<HTMLInputElement>(null)\n  const [loginState, loginAction, carregando] = useActionState(`,
  'next-ref',
)

replaceOnce(
  `    const params = new URLSearchParams(window.location.search)\n    setNextPath(getSafeNextPath())\n\n    const frame = window.requestAnimationFrame(() => {`,
  `    const params = new URLSearchParams(window.location.search)\n    if (nextPathRef.current) {\n      nextPathRef.current.value = getSafeNextPath()\n    }\n\n    const frame = window.requestAnimationFrame(() => {`,
  'next-ref-effect',
)

replaceOnce(
  `  useEffect(() => {\n    if (!loginState.error) return\n\n    setTipoMensagem('erro')\n    setMensagem(loginState.error)\n  }, [loginState.error])\n\n`,
  ``,
  'remove-error-effect',
)

replaceOnce(
  `  const messageClass =\n    tipoMensagem === 'erro'\n      ? 'border-red-200/90 bg-red-50 text-red-700'\n      : tipoMensagem === 'sucesso'\n        ? 'border-emerald-200/90 bg-emerald-50 text-emerald-700'\n        : 'border-blue-100 bg-blue-50/80 text-[#05245c]'`,
  `  const displayedMessage = loginState.error || mensagem\n  const displayedMessageType: MessageType = loginState.error\n    ? 'erro'\n    : tipoMensagem\n\n  const messageClass =\n    displayedMessageType === 'erro'\n      ? 'border-red-200/90 bg-red-50 text-red-700'\n      : displayedMessageType === 'sucesso'\n        ? 'border-emerald-200/90 bg-emerald-50 text-emerald-700'\n        : 'border-blue-100 bg-blue-50/80 text-[#05245c]'`,
  'derived-message',
)

replaceOnce(
  `              <input type="hidden" name="next" value={nextPath} />`,
  `              <input\n                ref={nextPathRef}\n                type="hidden"\n                name="next"\n                defaultValue="/painel/inicio"\n              />`,
  'hidden-next-ref',
)

replaceOnce(
  `                  <span>{mensagem}</span>`,
  `                  <span>{displayedMessage}</span>`,
  'render-server-error',
)

if (source.includes('setNextPath(')) throw new Error('Refinement incompleto: setNextPath ainda existe.')
if (source.includes("if (!loginState.error) return")) {
  throw new Error('Refinement incompleto: error state effect ainda existe.')
}
if (!source.includes('action={loginAction}')) throw new Error('Form deixou de usar Server Action.')
if (!source.includes('ref={nextPathRef}')) throw new Error('Hidden next não usa ref progressiva.')

await writeFile(file, source)
console.log('Login progressive enhancement refinement applied safely.')
