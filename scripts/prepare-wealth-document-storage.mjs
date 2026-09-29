import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {stagingRef,stagingUrl,serviceKey} from './helpers/staging-credentials.mjs'
assert.equal(fs.readFileSync('supabase/.temp/project-ref','utf8').trim(),stagingRef)
const admin=createClient(stagingUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
const bucket='wealth-documents',settings={public:false,fileSizeLimit:3145728,allowedMimeTypes:['application/pdf','image/jpeg','image/png']}
const list=await admin.storage.listBuckets();if(list.error)throw Error(list.error.message)
const exists=list.data.find(b=>b.id===bucket)
if(!exists){const result=await admin.storage.createBucket(bucket,settings);if(result.error)throw Error(result.error.message)}
const result=await admin.storage.getBucket(bucket);if(result.error)throw Error(result.error.message)
assert.equal(result.data.public,false);assert.equal(Number(result.data.file_size_limit),settings.fileSizeLimit)
assert.deepEqual([...result.data.allowed_mime_types].sort(),[...settings.allowedMimeTypes].sort())
console.log(JSON.stringify({project:stagingRef,bucket,created:!exists,...settings}))
