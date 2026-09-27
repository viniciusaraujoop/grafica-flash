import assert from 'node:assert/strict'

const sourceCommit=process.env.GITHUB_SHA
const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL
const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
const stagingUrl='https://zwxulgpjucxudadjdqov.supabase.co'
const controlUrl=stagingUrl+'/functions/v1/wealth-rolling-qa-control'
const audience='orcaly-wealth-rolling-qa'
if(!sourceCommit||!requestUrl||!requestToken)throw Error('GitHub OIDC environment unavailable')

async function oidc(){
 const separator=requestUrl.includes('?')?'&':'?'
 const response=await fetch(requestUrl+separator+'audience='+encodeURIComponent(audience),{headers:{Authorization:'bearer '+requestToken}})
 if(!response.ok)throw Error('OIDC mint failed: '+response.status)
 const body=await response.json()
 if(!body?.value)throw Error('OIDC token missing')
 return body.value
}
async function control(token,body){
 const response=await fetch(controlUrl,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...body,sourceCommit})})
 const payload=await response.json().catch(()=>null)
 if(!response.ok)throw Error('QA control '+String(body.action)+' failed: '+response.status+' '+JSON.stringify(payload))
 return payload
}
async function create(mode){
 const token=await oidc()
 const row=await control(token,{action:'create',mode})
 for(const key of ['userId','email','password'])assert.ok(row?.[key])
 return row
}
async function cleanup(row){
 if(!row?.userId)return
 const token=await oidc()
 await control(token,{action:'cleanup',userId:row.userId})
}
async function resolvePreview(){
 for(let attempt=1;attempt<=90;attempt++){
  const token=await oidc()
  const access=await control(token,{action:'preview_access'})
  const share=String(access?.share||'')
  try{
   const u=new URL(share)
   const shareToken=u.searchParams.get('_vercel_share')||''
   if(u.protocol!=='https:'||!/^orcaly-[a-z0-9]+-vinicius-araujos-projects\.vercel\.app$/.test(u.hostname)||u.hostname.includes('-git-')||!shareToken)throw Error('invalid preview share')
   const response=await fetch(u.origin+'/api/internal/preview-build?_vercel_share='+encodeURIComponent(shareToken),{redirect:'follow'})
   const contentType=response.headers.get('content-type')||''
   const body=contentType.includes('application/json')?await response.json():null
   const observed=String(body?.commit||'')
   console.log('preview attempt='+attempt+' status='+response.status+' commit='+(observed||'none'))
   if(response.status===200&&body?.environment==='preview'&&observed===sourceCommit)return {origin:u.origin,shareToken}
  }catch(error){
   console.log('preview attempt='+attempt+' unavailable')
  }
  await new Promise(resolve=>setTimeout(resolve,4000))
 }
 throw Error('Exact protected Preview did not converge to '+sourceCommit)
}

let a,b,no
try{
 [a,b,no]=await Promise.all([create('full'),create('full'),create('none')])
 const preview=await resolvePreview()
 Object.assign(process.env,{
  ORCALY_E2E_BASE_URL:preview.origin,
  ORCALY_EXPECTED_COMMIT:sourceCommit,
  VERCEL_PREVIEW_SHARE:preview.shareToken,
  ORCALY_QA_OIDC_TOKEN:await oidc(),
  QA_A_ID:a.userId,QA_A_EMAIL:a.email,QA_A_PASSWORD:a.password,
  QA_B_ID:b.userId,QA_B_EMAIL:b.email,QA_B_PASSWORD:b.password,
  QA_NO_ID:no.userId,QA_NO_EMAIL:no.email,QA_NO_PASSWORD:no.password,
 })
 await import('./e2e-wealth-ask-hosted.mjs')
}finally{
 for(const row of [a,b,no])await cleanup(row).catch(error=>console.error('cleanup',error.message))
}
