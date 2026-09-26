'use client'
export default function ErrorPage({reset}:{reset:()=>void}){return <section><h1>Central indisponível</h1><p>Não foi possível consultar suas automações.</p><button onClick={reset}>Tentar novamente</button></section>}
