import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {PlanningLink,PlanningOption} from './planning'

/** Bounded selectors plus already linked records; every query repeats owner and RLS applies. */
export async function planningOptions(db:SupabaseClient,userId:string,links:PlanningLink[]=[]):Promise<PlanningOption[]>{
 const definitions=[
  {kind:'goal' as const,table:'wealth_goals',columns:'id,title,target_cents',url:'/apps/wealth/metas/',amount:'target_cents'},
  {kind:'debt' as const,table:'wealth_entries',columns:'id,title,amount_cents',url:'/apps/wealth/dividas/',amount:'amount_cents'},
  {kind:'income' as const,table:'wealth_entries',columns:'id,title,amount_cents',url:'/apps/wealth/lancamentos/',amount:'amount_cents'},
  {kind:'portfolio' as const,table:'wealth_portfolios',columns:'id,name',url:'/apps/wealth/carteiras/',amount:''},
  {kind:'recurring' as const,table:'wealth_recurring_schedules',columns:'id,title,amount_cents',url:'/apps/wealth/recorrencias#',amount:'amount_cents'},
 ]
 const groups=await Promise.all(definitions.map(async d=>{
  const base=()=>{let q=db.from(d.table).select(d.columns).eq('user_id',userId)
   if(d.kind==='portfolio')q=q.eq('kind','real')
   else if(d.kind==='recurring')q=q.eq('status','active')
   else {q=q.is('archived_at',null);if(d.kind!=='goal')q=q.eq('kind',d.kind==='debt'?'liability':'income')}
   return q
  }
  const selected=links.filter(l=>l.kind===d.kind&&l.id).map(l=>l.id!)
  const [first,extra]=await Promise.all([base().order('id').limit(100),selected.length?base().in('id',selected):Promise.resolve({data:[],error:null})])
  if(first.error||extra.error)throw Error('Não foi possível consultar as fontes de planejamento.')
  const rows=[...(first.data||[]),...(extra.data||[])] as unknown as Record<string,unknown>[]
  return [...new Map(rows.map(r=>[String(r.id),{kind:d.kind,id:String(r.id),title:String(r.title??r.name),href:d.url+r.id,amount:d.amount?String(r[d.amount]):null}])).values()]
 }))
 return groups.flat()
}
export async function planningToday(db:SupabaseClient,userId:string){
 const {data,error}=await db.from('wealth_profiles').select('timezone').eq('user_id',userId).maybeSingle()
 if(error)throw Error('Não foi possível consultar o fuso do planejamento.')
 return new Intl.DateTimeFormat('en-CA',{timeZone:data?.timezone||'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
}
