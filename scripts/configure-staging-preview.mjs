import fs from 'node:fs'
import {spawn,execFileSync} from 'node:child_process'
import {stagingUrl,anonKey,serviceKey} from './helpers/staging-credentials.mjs'

const project='prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O',team='team_c5p2Uiz9b1SqKxOhmnmxUWZH',branch='codex/orcaly-ecosystem'
const linked=JSON.parse(fs.readFileSync('.vercel/project.json','utf8'))
if(linked.projectId!==project||linked.orgId!==team||execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim()!==branch)throw new Error('Wrong Vercel project/team or Git branch')
for(const [key,value,sensitive] of [['NEXT_PUBLIC_SUPABASE_URL',stagingUrl,false],['NEXT_PUBLIC_SUPABASE_ANON_KEY',anonKey,false],['SUPABASE_SERVICE_ROLE_KEY',serviceKey,true],['ORCALY_WEALTH_ENABLED','true',false]]){
 // Values go through stdin without shell interpolation or command-line exposure.
 const command=`npx --yes vercel env add ${key} preview ${branch} --project ${project} --scope ${team} --yes ${sensitive?'--sensitive':'--no-sensitive'}`
 const child=spawn('cmd.exe',['/d','/s','/c',command],{windowsHide:true,stdio:['pipe','pipe','pipe']})
 child.stdin.end(value)
 let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c)
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)})
 if(code!==0)throw new Error(`Vercel env add failed for ${key}: ${output.replaceAll(value,'[REDACTED]')}`)
 console.log(`Configured ${key}: Preview / ${branch} only`)
}
