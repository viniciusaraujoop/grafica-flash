import {spawn} from 'node:child_process'
import fs from 'node:fs'
import {stagingRef,stagingUrl,anonKey,serviceKey} from './helpers/staging-credentials.mjs'

const port='4174'
fs.mkdirSync('.local-qa/staging-browser',{recursive:true})
const log=fs.createWriteStream('.local-qa/staging-browser/app.log')
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',port],{
 windowsHide:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:stagingUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:anonKey,SUPABASE_SERVICE_ROLE_KEY:serviceKey,NEXT_PUBLIC_APP_URL:`http://127.0.0.1:${port}`,NEXT_PUBLIC_SITE_URL:`http://127.0.0.1:${port}`,ORCALY_WEALTH_ENABLED:'true',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']
})
for(const stream of [app.stdout,app.stderr])stream.on('data',chunk=>{log.write(chunk);process.stdout.write(chunk)})
console.log(`QA app uses ONLY Supabase staging ${stagingRef}; port ${port}. No .env file modified.`)
process.on('SIGINT',()=>app.kill());process.on('SIGTERM',()=>app.kill())
app.on('exit',code=>{log.end();process.exitCode=code??0})
