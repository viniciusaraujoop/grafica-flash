import {financialDate,integer} from './core'
export const timelineSources={entries:'Lançamentos',goals:'Metas',profile:'Perfil pessoal',recurrence:'Recorrências',bills:'Contas e assinaturas',debt:'Dívidas',snapshots:'Snapshots de patrimônio',portfolios:'Carteiras',holdings:'Posições',transactions:'Movimentos de carteira',funding:'Funding de metas',plans:'Planos de vida',documents:'Documentos'}
export const timelineOperations={insert:'Criação registrada',update:'Atualização registrada',delete:'Remoção registrada',archived:'Arquivamento registrado',restored:'Restauração registrada',completed:'Meta marcada como concluída'}
export type TimelineEvent={id:string;recorded_at:string;source:keyof typeof timelineSources;operation:keyof typeof timelineOperations;title:string;href:string|null;contextState:'current'|'archived'|'snapshot'|'hypothetical'|'recorded'|'removed'|'unavailable'}
export type WealthTimeline={total:string;page:number;pageSize:50;timezone:string;asOf:string;items:TimelineEvent[]}
export function timelineQuery(query:Record<string,string|string[]|undefined>,today:string){
 const to=financialDate(query.to??today),from=financialDate(query.from??new Date(Date.parse(today+'T12:00:00Z')-89*86400000).toISOString().slice(0,10)),page=integer(query.page??'1',1,100000)
 const days=(Date.parse(to)-Date.parse(from))/86400000
 if(days<0||days>365)throw Error('Escolha um intervalo de até 366 dias.')
 const source=typeof query.source==='string'&&query.source?query.source:null,operation=typeof query.operation==='string'&&query.operation?query.operation:null
 if(source&&!Object.hasOwn(timelineSources,source)||operation&&!Object.hasOwn(timelineOperations,operation)||Array.isArray(query.source)||Array.isArray(query.operation))throw Error('Filtro inválido.')
 const asOf=typeof query.asOf==='string'?query.asOf:null
 if(Array.isArray(query.asOf)||asOf&&!Number.isFinite(Date.parse(asOf)))throw Error('Referência de paginação inválida.')
 return {from,to,page,source,operation,asOf}
}
export function timelinePageHref(q:ReturnType<typeof timelineQuery>,asOf:string,page:number){
 const params=new URLSearchParams({from:q.from,to:q.to,page:String(page),asOf});if(q.source)params.set('source',q.source);if(q.operation)params.set('operation',q.operation)
 return '?'+params.toString()
}
