import {financialDate,integer,parseMoney,title,uuid} from './core'
export const protectionCategories={life:'Vida',health:'Saúde',home:'Residência ou imóvel',vehicle:'Veículo',liability:'Responsabilidade',other:'Outro'}
export const premiumPeriods={unknown:'Período não informado',one_off:'Parcela única',monthly:'Por mês',quarterly:'Por trimestre',yearly:'Por ano'}
export const shieldFilters={current:'Não arquivados',ending:'Fim informado em até 30 dias',expired:'Prazo informado encerrado',unknown:'Dados incompletos',cancelled:'Cancelamento informado',archived:'Arquivados'}
export const termLabels={archived:'Registro arquivado',cancelled:'Cancelamento informado',expired:'Prazo informado encerrado',future:'Início informado futuro',unknown:'Vigência incompleta',informed_term:'Dentro do prazo informado'}
export type ProtectionPolicy={id:string;title:string;category:keyof typeof protectionCategories;insurer:string;reference:string;coverage_cents:string|null;deductible_cents:string|null;premium_cents:string|null;premium_period:keyof typeof premiumPeriods;starts_on:string|null;ends_on:string|null;status:'declared'|'cancelled';notes:string;version:number;archived_at:string|null;asset_id:string|null;document_id:string|null;schedule_id:string|null;temporal:keyof typeof termLabels;asset:{id:string;title:string;archived:boolean}|null;document:{id:string;title:string}|null;schedule:{id:string;title:string;status:string}|null}
export type ShieldOverview={date:string;provider_status:'NOT_CONFIGURED';count:string;summary:{current:string;ending:string;expired:string;unknown:string;missing_document:string};policies:ProtectionPolicy[];selected:ProtectionPolicy|null}
export type ShieldOptions={assets:{id:string;title:string}[];documents:{id:string;title:string}[];schedules:{id:string;title:string}[]}
export function protectionCommand(form:FormData){
 const operation=String(form.get('operation')??''),s=(k:string)=>String(form.get(k)??'').trim()
 if(!['save','archive','restore'].includes(operation)||form.get('confirmed')!=='yes')throw Error('Confira e confirme esta declaração.')
 const input:Record<string,string|number|null>={idempotency_key:uuid(form.get('idempotency_key')),confirmed:'yes'}
 if(s('id')){input.id=uuid(s('id'));input.version=integer(form.get('version'),1,Number.MAX_SAFE_INTEGER)}
 if(operation==='save'){
  input.title=title(form.get('title'));input.category=s('category');input.premium_period=s('premium_period');input.status=s('status')
  if(!Object.hasOwn(protectionCategories,String(input.category))||!Object.hasOwn(premiumPeriods,String(input.premium_period))||!['declared','cancelled'].includes(String(input.status)))throw Error('Classificação inválida.')
  for(const [k,max] of [['insurer',120],['reference',160],['notes',2000]] as const){if(s(k).length>max)throw Error('Texto acima do limite.');input[k]=s(k)}
  for(const key of ['coverage','deductible','premium'])input[`${key}_cents`]=s(key)?String(parseMoney(s(key))):null
  for(const key of ['starts_on','ends_on'])input[key]=s(key)?financialDate(s(key)):null
  if(input.starts_on&&input.ends_on&&input.ends_on<input.starts_on)throw Error('O fim deve ser igual ou posterior ao início.')
  for(const key of ['asset_id','document_id','schedule_id'])input[key]=s(key)?uuid(s(key)):null
 }
 return {operation,input}
}
