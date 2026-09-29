'use client'
export default function ErrorPage({reset}:{reset:()=>void}){return <section><h1>Cofre temporariamente indisponível</h1><p>Não foi possível confirmar seus documentos.</p><button onClick={reset}>Tentar novamente</button></section>}
