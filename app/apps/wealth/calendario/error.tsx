'use client'
export default function CalendarError({reset}:{reset:()=>void}){return <section><h1>Não foi possível abrir esta consulta</h1><p>Seus registros foram preservados. Tente novamente em instantes.</p><button onClick={reset}>Tentar novamente</button></section>}
