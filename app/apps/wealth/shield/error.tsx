'use client'
export default function ErrorPage({reset}:{reset:()=>void}){return <section><h1>Shield indisponível</h1><p>Não foi possível confirmar seus registros de proteção.</p><button onClick={reset}>Tentar novamente</button></section>}
