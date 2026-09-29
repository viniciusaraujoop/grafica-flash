import {createHash} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {enforceRateLimit} from '@/lib/security/rate-limit'
import {readJsonBody,requestBodyErrorResponse} from '@/lib/security/request'
import {readWealthSummary} from '@/lib/wealth/summary'
import {readNetWorth} from '@/lib/wealth/net-worth'
import {readHealthInputs,healthIndicators} from '@/lib/wealth/health'
import {readAlertsOverview} from '@/lib/wealth/alerts'
import {readTaxCenter} from '@/lib/wealth/tax'
import {readFeeAnalysis} from '@/lib/wealth/fees'
import {
 askSources,classifyAsk,compactAskContext,localAskAnswer,parseAskRequest,
 providerInput,providerInstructions,providerOutputText,validateAskGoals,
 type AskContext,type AskProviderStatus,type AskSourceId
} from '@/lib/wealth/ask'

function providerError(value:unknown){
 if(!value||typeof value!=='object')return ''
 const root=value as Record<string,unknown>,error=root.error
 return error&&typeof error==='object'&&typeof (error as Record<string,unknown>).message==='string'
  ?String((error as Record<string,unknown>).message).slice(0,500):''
}

function sameOrigin(request:NextRequest){
 const origin=request.headers.get('origin')
 if(!origin)return true
 try{return new URL(origin).origin===request.nextUrl.origin}catch{return false}
}

export async function POST(request:NextRequest){
 try{
  if(!sameOrigin(request))return NextResponse.json({error:'Origem não permitida.'},{status:403})
  const access=await getPersonalProductAccess('wealth','wealth.read')
  if(!access.allowed||!access.identity)return NextResponse.json({error:'Ask Wealth indisponível para esta conta.'},{status:403})
  const limited=await enforceRateLimit(request,{scope:'wealth-ask-user-minute',identity:access.identity.user.id,limit:12,windowSeconds:60})
  if(limited)return limited

  const ask=parseAskRequest(await readJsonBody(request,8*1024))
  const {db,user}=access.identity
  const profile=await db.from('wealth_profiles').select('timezone').eq('user_id',user.id).maybeSingle()
  if(profile.error)return NextResponse.json({error:'Não foi possível confirmar seu contexto Wealth.'},{status:503})
  let timezone=profile.data?.timezone||'America/Sao_Paulo'
  try{new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(new Date())}catch{timezone='America/Sao_Paulo'}
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const month=date.slice(0,7)+'-01',yearFrom=date.slice(0,4)+'-01-01'

  const [summaryResult,netResult,healthResult,alertsResult,taxResult,feesResult,goalsResult]=await Promise.all([
   db.rpc('wealth_summary',{p_month:month}),
   db.rpc('wealth_net_worth'),
   db.rpc('wealth_health_inputs'),
   db.rpc('wealth_alerts_overview',{p_page:1,p_view:'active'}),
   db.rpc('wealth_tax_center',{p_from:yearFrom,p_to:date,p_page:1,p_portfolio:null}),
   db.rpc('wealth_fee_analysis',{p_from:month,p_to:date,p_page:1,p_portfolio:null}),
   db.from('wealth_goals').select('id,title,target_cents,saved_cents,monthly_contribution_cents,target_date,status').eq('user_id',user.id).is('archived_at',null).order('target_date').order('id').limit(50),
  ])

  const unavailable:AskSourceId[]=[]
  let summary:AskContext['summary']=null,netWorth:AskContext['netWorth']=null,health:AskContext['health']=[],alerts:AskContext['alerts']=null,tax:AskContext['tax']=null,fees:AskContext['fees']=null,goals:AskContext['goals']=[]

  try{if(summaryResult.error)throw summaryResult.error;summary=readWealthSummary(summaryResult.data)}catch{unavailable.push('summary')}
  try{if(netResult.error)throw netResult.error;netWorth=readNetWorth(netResult.data)}catch{unavailable.push('net_worth')}
  try{if(healthResult.error)throw healthResult.error;health=healthIndicators(readHealthInputs(healthResult.data))}catch{unavailable.push('health')}
  try{if(alertsResult.error)throw alertsResult.error;alerts=readAlertsOverview(alertsResult.data)}catch{unavailable.push('alerts')}
  try{if(taxResult.error)throw taxResult.error;tax=readTaxCenter(taxResult.data)}catch{unavailable.push('tax')}
  try{if(feesResult.error)throw feesResult.error;fees=readFeeAnalysis(feesResult.data)}catch{unavailable.push('fees')}
  try{if(goalsResult.error)throw goalsResult.error;goals=validateAskGoals(goalsResult.data??[])}catch{unavailable.push('goals')}

  const context:AskContext={date,timezone,month,year_from:yearFrom,summary,netWorth,health,goals,alerts,tax,fees,unavailable}
  const intent=classifyAsk(ask.question),local=localAskAnswer(context,ask,intent),sources=askSources(context,intent)
  const coreAvailable=sources.some(source=>source.status==='AVAILABLE')
  if(!coreAvailable&&intent!=='market')return NextResponse.json({error:'As fontes necessárias do Wealth estão indisponíveis. Nenhuma resposta foi estimada.'},{status:503})

  const apiKey=process.env.OPENAI_API_KEY?.trim()
  const model=process.env.ORCALY_WEALTH_AI_MODEL?.trim()
  const configured=process.env.ORCALY_WEALTH_AI_ENABLED==='true'&&Boolean(apiKey)&&Boolean(model)
  let providerStatus:AskProviderStatus=configured?'AVAILABLE_NOT_USED':'NOT_CONFIGURED'
  let providerUsed=false
  let answer=local.answer,warning:string|undefined
  const policyBoundary=local.boundary!==null

  if(configured&&ask.provider_consent&&!policyBoundary){
   const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({
     model,
     instructions:providerInstructions(ask.mode),
     input:providerInput(context,ask,intent),
     store:false,
     max_output_tokens:1200,
    }),
    signal:AbortSignal.timeout(25_000),
   }).catch(()=>null)
   if(response){
    const payload:unknown=await response.json().catch(()=>null)
    const generated=response.ok?providerOutputText(payload):''
    if(generated){answer=generated;providerStatus='OPENAI_USED';providerUsed=true}
    else{
     providerStatus='DEGRADED'
     warning=providerError(payload)||'Provider configurado, mas a resposta externa não pôde ser usada. A análise local foi preservada.'
    }
   }else{
    providerStatus='DEGRADED'
    warning='Provider configurado, mas indisponível nesta consulta. A análise local foi preservada.'
   }
  }

  const from=intent==='tax'?yearFrom:month
  return NextResponse.json({
   ok:true,
   mode:ask.mode,
   intent,
   answer,
   provider_status:providerStatus,
   provider_used:providerUsed,
   provider_consent:ask.provider_consent?'GRANTED_THIS_REQUEST':'NOT_GRANTED',
   regulated_advice:'OFF',
   execution:'OFF',
   cross_product_context:'DISABLED',
   market_provider_status:'NOT_CONFIGURED',
   context_id:createHash('sha256').update(JSON.stringify(compactAskContext(context,intent))).digest('hex').slice(0,24),
   period:{from,to:date,timezone},
   sources,
   hypotheses:local.hypotheses,
   limitations:[...local.limitations,...unavailable.map(id=>'Fonte indisponível nesta consulta: '+id+'.')],
   actions:local.actions,
   ...(warning?{warning}:{}),
  })
 }catch(error){
  const bodyError=requestBodyErrorResponse(error)
  if(bodyError)return bodyError
  return NextResponse.json({error:error instanceof Error?error.message:'Não foi possível consultar o Ask Wealth.'},{status:400})
 }
}
