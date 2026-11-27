import type { AppData, Plan, PlanExercise, Schedule, Session, SessionExercise, LogSet } from './lib'
import { supabase } from './lib'

function requireClient(){if(!supabase)throw new Error('Supabase is not configured.') ;return supabase}
function validId(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
export function makeCloudIds(data:AppData):AppData {
 const map=new Map<string,string>(),get=(id:string)=>{if(!map.has(id))map.set(id,validId(id)?id:crypto.randomUUID());return map.get(id)!}
 const plans=data.plans.map(p=>({...p,id:get(p.id),exercises:p.exercises.map(e=>({...e,id:get(e.id)}))}))
 return {...data,plans,schedules:data.schedules.map(s=>({...s,id:get(s.id),planId:get(s.planId)})),sessions:data.sessions.map(s=>({...s,id:get(s.id),planId:s.planId?get(s.planId):null,exercises:s.exercises.map(e=>({...e,id:get(e.id),sets:e.sets.map(x=>({...x,id:get(x.id)}))}))}))}
}
function check(error:any){if(error)throw new Error(error.message||'Supabase request failed.')}

export async function loadCloudData(userId:string):Promise<AppData>{
 const db=requireClient()
 const [plansResult,schedulesResult,sessionsResult]=await Promise.all([
  db.from('workout_plans').select('*,workout_plan_exercises(*)').eq('user_id',userId).order('created_at'),
  db.from('recurring_schedules').select('*').eq('user_id',userId),
  db.from('workout_sessions').select('*,session_exercises(*,exercise_sets(*))').eq('user_id',userId).order('started_at',{ascending:false})
 ])
 check(plansResult.error);check(schedulesResult.error);check(sessionsResult.error)
 const plans:Plan[]=(plansResult.data||[]).map((p:any)=>({id:p.id,name:p.name,description:p.description||'',exercises:(p.workout_plan_exercises||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((e:any):PlanExercise=>({id:e.id,exerciseId:e.exercise_id||'',name:e.exercise_name_snapshot,muscle:e.muscle_group_snapshot||'',sets:e.target_sets,reps:e.target_reps_text||'',weight:e.target_weight===null?null:Number(e.target_weight),notes:e.notes||''}))}))
 const schedules:Schedule[]=(schedulesResult.data||[]).map((s:any)=>({id:s.id,planId:s.workout_plan_id,day:s.day_of_week,active:s.is_active}))
 const sessions:Session[]=(sessionsResult.data||[]).map((s:any)=>({id:s.id,userId:s.user_id,userName:'You',planId:s.workout_plan_id,name:s.plan_name_snapshot,date:String(s.started_at).slice(0,10),startedAt:s.started_at,finishedAt:s.finished_at,duration:s.duration_seconds||0,status:s.status,notes:s.notes||'',exercises:(s.session_exercises||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((e:any):SessionExercise=>({id:e.id,name:e.exercise_name_snapshot,muscle:e.muscle_group_snapshot||'',targetSets:e.target_sets_snapshot,targetReps:e.target_reps_snapshot||'',status:e.status,notes:e.notes||'',sets:(e.exercise_sets||[]).sort((a:any,b:any)=>a.set_number-b.set_number).map((x:any):LogSet=>({id:x.id,weight:x.weight===null?null:Number(x.weight),reps:x.repetitions,done:x.is_completed}))}))}))
 return {plans,schedules,sessions}
}

let serial:Promise<void>=Promise.resolve()
export function queueCloudSave(userId:string,data:AppData):Promise<void>{const snapshot=structuredClone(data);serial=serial.catch(()=>{}).then(()=>saveSnapshot(userId,snapshot));return serial}
async function saveSnapshot(userId:string,data:AppData){
 const db=requireClient(),plans=data.plans,sessions=data.sessions.filter(s=>s.userId===userId)
 const planRows=plans.map(p=>({id:p.id,user_id:userId,name:p.name,description:p.description,updated_at:new Date().toISOString()}))
 if(planRows.length)check((await db.from('workout_plans').upsert(planRows)).error)
 const planIds=plans.map(p=>p.id),exerciseRows=plans.flatMap(p=>p.exercises.map((e,i)=>({id:e.id,workout_plan_id:p.id,exercise_id:null,sort_order:i,target_sets:e.sets,target_reps_text:e.reps,target_weight:e.weight,notes:e.notes,exercise_name_snapshot:e.name,muscle_group_snapshot:e.muscle||''})))
 const oldPlanExercises=planIds.length?await db.from('workout_plan_exercises').select('id').in('workout_plan_id',planIds):{data:[],error:null};check(oldPlanExercises.error)
 if(exerciseRows.length)check((await db.from('workout_plan_exercises').upsert(exerciseRows)).error)
 const livePlanExerciseIds=new Set(exerciseRows.map((x:any)=>x.id)),stalePlanExerciseIds=(oldPlanExercises.data||[]).map((x:any)=>x.id).filter((id:string)=>!livePlanExerciseIds.has(id))
 if(stalePlanExerciseIds.length)check((await db.from('workout_plan_exercises').delete().in('id',stalePlanExerciseIds)).error)
 const oldSchedules=await db.from('recurring_schedules').select('id').eq('user_id',userId);check(oldSchedules.error)
 const scheduleRows=data.schedules.map(s=>({id:s.id,user_id:userId,workout_plan_id:s.planId,day_of_week:s.day,is_active:s.active}))
 if(scheduleRows.length)check((await db.from('recurring_schedules').upsert(scheduleRows)).error)
 const liveSchedules=new Set(scheduleRows.map(s=>s.id)),staleSchedules=(oldSchedules.data||[]).map((s:any)=>s.id).filter((id:string)=>!liveSchedules.has(id))
 if(staleSchedules.length)check((await db.from('recurring_schedules').delete().in('id',staleSchedules)).error)
 const sessionRows=sessions.map(s=>({id:s.id,user_id:userId,workout_plan_id:s.planId,scheduled_workout_id:null,plan_name_snapshot:s.name,started_at:s.startedAt,finished_at:s.finishedAt,duration_seconds:s.duration,status:s.status,notes:s.notes}))
 if(sessionRows.length)check((await db.from('workout_sessions').upsert(sessionRows)).error)
 const sessionIds=sessions.map(s=>s.id),sessionExerciseRows=sessions.flatMap(s=>s.exercises.map((e,i)=>({id:e.id,session_id:s.id,exercise_id:null,sort_order:i,status:e.status,notes:e.notes,exercise_name_snapshot:e.name,muscle_group_snapshot:e.muscle,target_sets_snapshot:e.targetSets,target_reps_snapshot:e.targetReps,target_weight_snapshot:null})))
 const oldSessionExercises=sessionIds.length?await db.from('session_exercises').select('id').in('session_id',sessionIds):{data:[],error:null};check(oldSessionExercises.error)
 if(sessionExerciseRows.length)check((await db.from('session_exercises').upsert(sessionExerciseRows)).error)
 const liveSessionExerciseIds=new Set(sessionExerciseRows.map((e:any)=>e.id)),staleSessionExerciseIds=(oldSessionExercises.data||[]).map((e:any)=>e.id).filter((id:string)=>!liveSessionExerciseIds.has(id))
 if(staleSessionExerciseIds.length)check((await db.from('session_exercises').delete().in('id',staleSessionExerciseIds)).error)
 const sessionExerciseIds=sessionExerciseRows.map(e=>e.id),setRows=sessions.flatMap(s=>s.exercises.flatMap(e=>e.sets.map((x,i)=>({id:x.id,session_exercise_id:e.id,set_number:i+1,weight:x.weight,repetitions:x.reps,is_completed:x.done,completed_at:x.done?new Date().toISOString():null}))))
 const oldSets=sessionExerciseIds.length?await db.from('exercise_sets').select('id').in('session_exercise_id',sessionExerciseIds):{data:[],error:null};check(oldSets.error)
 if(setRows.length)check((await db.from('exercise_sets').upsert(setRows)).error)
 const liveSetIds=new Set(setRows.map((x:any)=>x.id)),staleSetIds=(oldSets.data||[]).map((x:any)=>x.id).filter((id:string)=>!liveSetIds.has(id))
 if(staleSetIds.length)check((await db.from('exercise_sets').delete().in('id',staleSetIds)).error)
 const oldSessions=await db.from('workout_sessions').select('id').eq('user_id',userId);check(oldSessions.error)
 const liveSessionIds=new Set(sessionIds),staleSessionIds=(oldSessions.data||[]).map((x:any)=>x.id).filter((id:string)=>!liveSessionIds.has(id))
 if(staleSessionIds.length)check((await db.from('workout_sessions').delete().in('id',staleSessionIds)).error)
 const oldPlans=await db.from('workout_plans').select('id').eq('user_id',userId);check(oldPlans.error)
 const livePlanIds=new Set(planIds),stalePlanIds=(oldPlans.data||[]).map((x:any)=>x.id).filter((id:string)=>!livePlanIds.has(id))
 if(stalePlanIds.length)check((await db.from('workout_plans').delete().in('id',stalePlanIds)).error)
}
