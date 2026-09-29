'use client'
export default function ErrorPage({reset}:{reset:()=>void}){return <section><h1>Family indisponível</h1><p>Não foi possível consultar seus acessos. Tente novamente.</p><button onClick={reset}>Tentar novamente</button></section>}
