import { createClient } from '@supabase/supabase-js'
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export type Exercise = { id:string; name:string; muscle:string; equipment:string }
export type PlanExercise = { id:string; exerciseId:string; name:string; muscle:string; sets:number; reps:string; weight:number|null; notes:string }
export type Plan = { id:string; name:string; description:string; exercises:PlanExercise[] }
export type LogSet = { id:string; weight:number|null; reps:number|null; done:boolean }
export type SessionExercise = { id:string; name:string; muscle:string; targetSets:number; targetReps:string; status:'pending'|'completed'|'skipped'; notes:string; sets:LogSet[] }
export type Session = { id:string; userId:string; userName:string; planId:string|null; name:string; date:string; startedAt:string; finishedAt:string|null; duration:number; status:'in_progress'|'completed'|'cancelled'; notes:string; exercises:SessionExercise[] }
export type Schedule = { id:string; planId:string; day:number; active:boolean }
export type AppData = { plans:Plan[]; sessions:Session[]; schedules:Schedule[] }
export const people = [{id:'me',name:'Alex',initials:'AL',color:'orange'},{id:'partner',name:'Sam',initials:'SM',color:'purple'}]
export const library:Exercise[] = [
  ['Barbell Bench Press','Chest','Barbell'],['Incline Dumbbell Press','Chest','Dumbbell'],['Cable Fly','Chest','Cable'],['Push-up','Chest','Bodyweight'],
  ['Barbell Row','Back','Barbell'],['Lat Pulldown','Back','Cable'],['Pull-ups','Back','Bodyweight'],['Seated Cable Row','Back','Cable'],['Deadlift','Back','Barbell'],['Romanian Deadlift','Hamstrings','Barbell'],
  ['Overhead Press','Shoulders','Barbell'],['Lateral Raise','Shoulders','Dumbbell'],['Face Pull','Shoulders','Cable'],['Barbell Curl','Biceps','Barbell'],['Dumbbell Curl','Biceps','Dumbbell'],['Triceps Pushdown','Triceps','Cable'],['Skull Crushers','Triceps','Barbell'],
  ['Barbell Squat','Quadriceps','Barbell'],['Leg Press','Quadriceps','Machine'],['Leg Extension','Quadriceps','Machine'],['Leg Curl','Hamstrings','Machine'],['Hip Thrust','Glutes','Barbell'],['Calf Raise','Calves','Machine'],['Plank','Abdominals','Bodyweight'],['Hanging Leg Raise','Abdominals','Bodyweight'],['Farmer Carry','Forearms','Dumbbell'],['Burpee','Full Body','Bodyweight']
].map(([name,muscle,equipment],i)=>({id:`lib-${i}`,name,muscle,equipment}))
export const seedData:AppData = {
 plans:[
  {id:'plan-a',name:'Full Body A',description:'A balanced strength session.',exercises:[['Barbell Squat','Quadriceps',3,'8–10'],['Barbell Bench Press','Chest',3,'8–10'],['Barbell Row','Back',3,'8–10'],['Romanian Deadlift','Hamstrings',3,'10–12']].map(([name,muscle,sets,reps],i)=>({id:`pa-${i}`,exerciseId:`lib-${i}`,name:String(name),muscle:String(muscle),sets:Number(sets),reps:String(reps),weight:null,notes:''}))},
  {id:'plan-b',name:'Full Body B',description:'A second full body day.',exercises:[['Deadlift','Back',3,'5–6'],['Overhead Press','Shoulders',3,'8–10'],['Lat Pulldown','Back',3,'10–12'],['Leg Press','Quadriceps',3,'10–12']].map(([name,muscle,sets,reps],i)=>({id:`pb-${i}`,exerciseId:`lib-${i+4}`,name:String(name),muscle:String(muscle),sets:Number(sets),reps:String(reps),weight:null,notes:''}))}
 ], sessions:[], schedules:[{id:'s1',planId:'plan-a',day:1,active:true},{id:'s2',planId:'plan-b',day:3,active:true},{id:'s3',planId:'plan-a',day:5,active:true}]
}
export function readData():AppData { try { const v=localStorage.getItem('form-fitness-data'); return v?JSON.parse(v):seedData } catch { return seedData } }
export function saveData(data:AppData) { localStorage.setItem('form-fitness-data',JSON.stringify(data)) }
export function makeSession(plan:Plan,userId:string,userName:string,date=new Date()):Session { const now=date.toISOString(); return {id:crypto.randomUUID(),userId,userName,planId:plan.id,name:plan.name,date:now.slice(0,10),startedAt:now,finishedAt:null,duration:0,status:'in_progress',notes:'',exercises:plan.exercises.map(e=>({id:crypto.randomUUID(),name:e.name,muscle:e.muscle,targetSets:e.sets,targetReps:e.reps,status:'pending',notes:e.notes,sets:Array.from({length:e.sets},()=>({id:crypto.randomUUID(),weight:e.weight,reps:null,done:false}))}))} }
export function sessionStats(s:Session){const sets=s.exercises.flatMap(e=>e.sets).filter(x=>x.done);return {sets:sets.length,volume:sets.reduce((a,x)=>a+(x.weight||0)*(x.reps||0),0),completed:s.exercises.filter(e=>e.status==='completed').length,skipped:s.exercises.filter(e=>e.status==='skipped').length}}
