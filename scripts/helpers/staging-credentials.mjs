import fs from 'node:fs'
export const stagingRef='zwxulgpjucxudadjdqov'
export const stagingUrl=`https://${stagingRef}.supabase.co`
const file=process.env.ORCALY_STAGING_KEYS_FILE||'.local-qa/reconciliation/staging-api-keys.json'
const keys=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
export const anonKey=keys.find(k=>k.name==='anon')?.api_key
export const serviceKey=keys.find(k=>k.name==='service_role')?.api_key
for(const [key,role] of [[anonKey,'anon'],[serviceKey,'service_role']]){
 if(!key)throw new Error(`Missing staging ${role} key`)
 const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url'))
 if(claims.ref!==stagingRef||claims.role!==role)throw new Error('Credentials are not for the approved staging project')
}
