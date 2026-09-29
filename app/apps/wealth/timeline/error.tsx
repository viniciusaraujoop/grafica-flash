'use client'
export default function ErrorPage({reset}:{reset:()=>void}){return <section><h1>Timeline temporariamente indisponível</h1><p>Não foi possível confirmar as atividades.</p><button onClick={reset}>Tentar novamente</button></section>}
