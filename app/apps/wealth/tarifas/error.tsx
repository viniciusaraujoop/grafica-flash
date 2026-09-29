'use client'
export default function ErrorPage({reset}:{reset:()=>void}){return <section><h1>Análise indisponível</h1><p>Não foi possível confirmar os custos completos. Nenhum valor foi estimado.</p><button onClick={reset}>Tentar novamente</button></section>}
