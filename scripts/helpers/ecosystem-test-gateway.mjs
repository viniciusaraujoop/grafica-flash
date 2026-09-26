/** TEST ONLY: a minimal Auth/PostgREST protocol fixture backed by real PGlite RLS.
 * It does not certify hosted Supabase Auth, refresh, email delivery or production schema drift.
 * Binds only to loopback; rejects all non-fixture tokens. Never imported by application code.
 */
import { createServer } from 'node:http'
import { createHmac, randomBytes } from 'node:crypto'
import { createTestDatabase, ids, asUser, asAdmin } from './ecosystem-test-db.mjs'

export async function startTestGateway(port = 54329) {
  const db = await createTestDatabase()
  const secret = randomBytes(32)
  const tokens = new Map()
  const users = new Map()
  for (const [label, id] of Object.entries(ids).filter(([label]) => ['a','b','member'].includes(label))) {
    const user = { id, aud: 'authenticated', role: 'authenticated', email: `${label}@ecosystem.test`, app_metadata: {}, user_metadata: {}, factors: [], created_at: '2026-01-01T00:00:00Z' }
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', email: user.email, aal: 'aal1', amr: [], iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')
    const signature = createHmac('sha256',secret).update(`${header}.${payload}`).digest('base64url')
    const token = `${header}.${payload}.${signature}`
    const session = { access_token: token, refresh_token: `fixture-${label}`, expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user }
    tokens.set(token,session);users.set(label,session)
  }
  const tables = new Set(['companies','company_members','affiliate_profiles','platform_admins','ecosystem_product_entitlements','ecosystem_context_consents','wealth_profiles','wealth_entries','wealth_goals'])
  const identifier = value => { if(!/^[a-z_][a-z_0-9]*$/.test(value)) throw new Error('Invalid test identifier');return `"${value}"` }
  let queue = Promise.resolve()
  const server = createServer((request,response)=>{
    const perform = async()=>{
      response.setHeader('Access-Control-Allow-Origin',`http://127.0.0.1:4174`)
      response.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,prefer')
      response.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS')
      if(request.method==='OPTIONS'){response.writeHead(204);response.end();return}
      const token=String(request.headers.authorization||'').replace(/^Bearer /i,'')
      const session=tokens.get(token)
      const url=new URL(request.url,`http://127.0.0.1:${port}`)
      function send(code,data,headers={}){response.writeHead(code,{'content-type':'application/json',...headers});response.end(JSON.stringify(data))}
      if(!session){send(401,{message:'Invalid fixture token',code:'bad_jwt'});return}
      if(url.pathname==='/auth/v1/user'){send(200,session.user);return}
      if(!url.pathname.startsWith('/rest/v1/')){send(404,{message:'Unsupported test route'});return}
      const table=url.pathname.split('/').at(-1)
      if(!tables.has(table)){send(404,{code:'42P01',message:'Unsupported fixture relation'});return}
      // Legacy identity checks have no partner/admin profile for fixture users.
      if(['affiliate_profiles','platform_admins'].includes(table)){send(200,request.headers.accept?.includes('object')?null:[]);return}
      const values=[]
      const predicates=[]
      for(const [key,filter] of url.searchParams){
        if(['select','order','limit','offset','on_conflict'].includes(key))continue
        const match=/^(eq|is)\.(.*)$/.exec(filter)
        if(!match)throw new Error('Unsupported test filter')
        if(match[1]==='is'&&match[2]==='null')predicates.push(`${identifier(key)} is null`)
        else{values.push(match[2]);predicates.push(`${identifier(key)}=$${values.length}`)}
      }
      const where=predicates.length?` where ${predicates.join(' and ')}`:''
      await asUser(db,session.user.id)
      if(request.method==='GET'){
        const columns=url.searchParams.get('select')||'*'
        const select=columns==='*'?'*':columns.split(',').map(identifier).join(',')
        const order=url.searchParams.get('order')
        const ordering=order?` order by ${order.split(',').map(item=>{const [col,dir]=item.split('.');return `${identifier(col)} ${dir==='desc'?'desc':'asc'}`}).join(',')}`:''
        const limit=Math.min(Number(url.searchParams.get('limit')||1000),1000)
        if(!Number.isInteger(limit)||limit<1)throw new Error('Bad fixture limit')
        const {rows}=await db.query(`select ${select} from public.${identifier(table)}${where}${ordering} limit ${limit}`,values)
        const count=(await db.query(`select count(*)::int as total from public.${identifier(table)}${where}`,values)).rows[0].total
        const normalized=rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,key.endsWith('_cents')?Number(value):['financial_date','target_date'].includes(key)&&value instanceof Date?value.toISOString().slice(0,10):value])))
        if(request.headers.accept?.includes('object')&&normalized.length!==1){send(406,{code:'PGRST116',details:`The result contains ${normalized.length} rows`});return}
        send(200,request.headers.accept?.includes('object')?normalized[0]:normalized,{'content-range':normalized.length?`0-${normalized.length-1}/${count}`:`*/${count}`});return
      }
      let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>65536)throw new Error('Fixture body too large')}
      const body=JSON.parse(raw)
      const fields=Object.keys(body);const data=Object.values(body)
      let result
      if(request.method==='POST'){
        const upsert=String(request.headers.prefer||'').includes('resolution=merge-duplicates')
        const conflict=upsert?` on conflict (${identifier(url.searchParams.get('on_conflict')||'user_id')}) do update set ${fields.map(key=>`${identifier(key)}=excluded.${identifier(key)}`).join(',')}`:''
        result=await db.query(`insert into public.${identifier(table)}(${fields.map(identifier).join(',')}) values(${data.map((_,i)=>`$${i+1}`).join(',')})${conflict} returning *`,data)
      }else if(request.method==='PATCH'){
        const assignments=fields.map((key,i)=>`${identifier(key)}=$${values.length+i+1}`).join(',')
        result=await db.query(`update public.${identifier(table)} set ${assignments}${where} returning *`,[...values,...data])
      }else{send(405,{message:'Unsupported fixture method'});return}
      send(200,String(request.headers.prefer||'').includes('return=representation')?result.rows:[])
    }
    queue=queue.then(perform).catch(error=>{
      if(!response.headersSent){response.writeHead(400,{'content-type':'application/json'});response.end(JSON.stringify({code:error.code||'TEST_GATEWAY',message:error.message}))}
      else response.end()
    })
  })
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve))
  return {
    session: label=>users.get(label),
    async inspect(query,params=[]){await queue;await asAdmin(db);return db.query(query,params)},
    async close(){await new Promise(resolve=>server.close(resolve));await db.close()},
  }
}
