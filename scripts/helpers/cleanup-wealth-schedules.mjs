// Remove only scheduling artifacts belonging to fixture users already authenticated by the caller.
export async function cleanupWealthSchedules(admin,userId,entities){
 const schedules=[]
 for(let offset=0;;offset+=500){
  const rows=await admin.from('wealth_recurring_schedules').select('id').eq('user_id',userId).order('id').range(offset,offset+499)
  if(rows.error)throw rows.error
  schedules.push(...rows.data)
  if(rows.data.length<500)break
 }
 for(const {id} of schedules){
  entities.add(id)
  for(const query of [
   admin.from('background_jobs').delete().eq('job_type','wealth.recurrence').eq('payload->>recurrence_id',id),
   admin.from('event_idempotency').delete().eq('provider','wealth_recurrence').like('event_id',id+':%'),
   admin.from('transactional_outbox').delete().eq('event_type','wealth.recurrence.generated').eq('aggregate_type','wealth_recurrence').eq('aggregate_id',id),
  ]){const result=await query;if(result.error)throw result.error}
 }
}

export async function wealthScheduleFixtureCounts(admin){
 const names=['schedulesRemaining','occurrencesRemaining','jobsRemaining','idempotencyRemaining','outboxRemaining']
 const results=await Promise.all([
  admin.from('wealth_recurring_schedules').select('id',{count:'exact',head:true}),
  admin.from('wealth_recurrence_occurrences').select('schedule_id',{count:'exact',head:true}),
  admin.from('background_jobs').select('id',{count:'exact',head:true}).eq('job_type','wealth.recurrence'),
  admin.from('event_idempotency').select('id',{count:'exact',head:true}).eq('provider','wealth_recurrence'),
  admin.from('transactional_outbox').select('id',{count:'exact',head:true}).eq('event_type','wealth.recurrence.generated'),
 ])
 for(const result of results)if(result.error||result.count===null)throw result.error||Error('Cleanup count unavailable')
 return Object.fromEntries(results.map((result,index)=>[names[index],result.count]))
}
