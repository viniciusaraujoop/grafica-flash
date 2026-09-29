import { isPlainRecord, isUuid, JobNeedsAttentionError } from '@/lib/jobs/core'
import { IntegrationError } from '@/lib/integrations/core/errors'
import type { JobHandler } from '@/lib/jobs/registry'

export const wealthRecurrenceJobHandler: JobHandler<{recurrenceId:string;occurrenceIndex:number}> = {
 type:'wealth.recurrence',
 validate(payload){
  if(!isPlainRecord(payload)||!isUuid(payload.recurrence_id)||!Number.isSafeInteger(payload.occurrence_index)||Number(payload.occurrence_index)<0)return {ok:false,error:'invalid_wealth_recurrence'}
  return {ok:true,value:{recurrenceId:payload.recurrence_id,occurrenceIndex:Number(payload.occurrence_index)}}
 },
 async execute({db,job,workerId}){
  if(process.env.ORCALY_WEALTH_ENABLED!=='true')throw new JobNeedsAttentionError('wealth_disabled')
  if(job.companyId)throw new JobNeedsAttentionError('personal_context_required')
  const {data,error,status}=await db.rpc('process_wealth_recurrence',{p_job_id:job.id,p_worker:workerId})
  if(error){
   if(status===0||status>=500||['40001','40P01','55P03','57014'].includes(error.code)||error.code?.startsWith('08'))throw new IntegrationError('TIMEOUT','Wealth processing will retry.')
   throw new JobNeedsAttentionError('wealth_recurrence_requires_review')
  }
  return isPlainRecord(data)?data:{status:'unknown'}
 },
}
