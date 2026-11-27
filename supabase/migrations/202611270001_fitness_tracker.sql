-- Run with Supabase CLI: supabase db push. Disable public sign-ups in Auth settings;
-- create the two accounts through the Supabase dashboard or an admin invite.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Athlete', avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.exercises (
  id uuid primary key default gen_random_uuid(), name text not null,
  description text, primary_muscle_group text not null,
  secondary_muscle_groups text[] not null default '{}', equipment text,
  is_custom boolean not null default false, created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint custom_exercise_owner check ((is_custom and created_by is not null) or (not is_custom and created_by is null))
);
create unique index exercises_shared_name_uq on public.exercises (lower(name)) where not is_custom;
create index exercises_creator_idx on public.exercises(created_by) where is_custom;
insert into public.exercises(name,primary_muscle_group,equipment) values
 ('Barbell Bench Press','Chest','Barbell'),('Incline Dumbbell Press','Chest','Dumbbell'),('Cable Fly','Chest','Cable'),('Push-up','Chest','Bodyweight'),
 ('Barbell Row','Back','Barbell'),('Lat Pulldown','Back','Cable'),('Pull-ups','Back','Bodyweight'),('Seated Cable Row','Back','Cable'),('Deadlift','Back','Barbell'),('Romanian Deadlift','Hamstrings','Barbell'),
 ('Overhead Press','Shoulders','Barbell'),('Lateral Raise','Shoulders','Dumbbell'),('Face Pull','Shoulders','Cable'),('Barbell Curl','Biceps','Barbell'),('Dumbbell Curl','Biceps','Dumbbell'),('Triceps Pushdown','Triceps','Cable'),('Skull Crushers','Triceps','Barbell'),
 ('Barbell Squat','Quadriceps','Barbell'),('Leg Press','Quadriceps','Machine'),('Leg Extension','Quadriceps','Machine'),('Leg Curl','Hamstrings','Machine'),('Hip Thrust','Glutes','Barbell'),('Calf Raise','Calves','Machine'),('Plank','Abdominals','Bodyweight'),('Hanging Leg Raise','Abdominals','Bodyweight'),('Farmer Carry','Forearms','Dumbbell'),('Burpee','Full Body','Bodyweight')
on conflict do nothing;
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index workout_plans_owner_idx on public.workout_plans(user_id, updated_at desc);
create table public.workout_plan_exercises (
  id uuid primary key default gen_random_uuid(), workout_plan_id uuid not null references public.workout_plans(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null, sort_order integer not null default 0,
  target_sets integer not null default 3 check(target_sets > 0), target_reps_min integer,
  target_reps_max integer, target_reps_text text not null default '8–12', target_weight numeric(8,2), notes text not null default '',
  exercise_name_snapshot text not null, muscle_group_snapshot text not null default '',
  created_at timestamptz not null default now(), constraint reps_range_check check(target_reps_min is null or target_reps_max is null or target_reps_min <= target_reps_max)
);
create index workout_plan_exercises_plan_idx on public.workout_plan_exercises(workout_plan_id,sort_order);
create table public.recurring_schedules (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  workout_plan_id uuid not null references public.workout_plans(id) on delete cascade,
  day_of_week smallint not null check(day_of_week between 0 and 6), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,day_of_week,workout_plan_id)
);
create index recurring_schedules_owner_day_idx on public.recurring_schedules(user_id,day_of_week) where is_active;
create table public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  workout_plan_id uuid references public.workout_plans(id) on delete set null, scheduled_date date not null,
  status text not null default 'upcoming' check(status in ('upcoming','in_progress','completed','missed','cancelled')),
  plan_name_snapshot text not null default 'Workout', schedule_source text not null default 'one_time' check(schedule_source in ('recurring','one_time')),
  created_at timestamptz not null default now(), unique(user_id,scheduled_date,workout_plan_id)
);
create index scheduled_workouts_owner_date_idx on public.scheduled_workouts(user_id,scheduled_date);
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  workout_plan_id uuid references public.workout_plans(id) on delete set null,
  scheduled_workout_id uuid references public.scheduled_workouts(id) on delete set null,
  plan_name_snapshot text not null, started_at timestamptz not null default now(), finished_at timestamptz,
  duration_seconds integer not null default 0 check(duration_seconds >= 0),
  status text not null default 'in_progress' check(status in ('in_progress','completed','cancelled','abandoned')),
  notes text not null default '', created_at timestamptz not null default now()
);
create index workout_sessions_owner_started_idx on public.workout_sessions(user_id,started_at desc);
create index workout_sessions_completed_idx on public.workout_sessions(user_id,finished_at desc) where status='completed';
create table public.session_exercises (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null, sort_order integer not null default 0,
  status text not null default 'pending' check(status in ('pending','completed','skipped')),
  notes text not null default '', exercise_name_snapshot text not null, muscle_group_snapshot text not null default '',
  target_sets_snapshot integer not null default 3, target_reps_snapshot text not null default '', target_weight_snapshot numeric(8,2),
  created_at timestamptz not null default now()
);
create index session_exercises_session_idx on public.session_exercises(session_id,sort_order);
create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(), session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  set_number integer not null check(set_number > 0), weight numeric(8,2) check(weight is null or weight>=0),
  repetitions integer check(repetitions is null or repetitions>=0), is_completed boolean not null default false,
  completed_at timestamptz, created_at timestamptz not null default now(), unique(session_exercise_id,set_number)
);
create index exercise_sets_exercise_idx on public.exercise_sets(session_exercise_id,set_number);

-- Keep profile rows in sync for newly invited accounts.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1))); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_exercises enable row level security;
alter table public.recurring_schedules enable row level security;
alter table public.scheduled_workouts enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.exercise_sets enable row level security;

-- Both authenticated household members can read progress and activity. Writes remain owner-only.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy exercises_read on public.exercises for select to authenticated using(not is_custom or created_by=auth.uid());
create policy exercises_insert_self on public.exercises for insert to authenticated with check((not is_custom and created_by is null) or (is_custom and created_by=auth.uid()));
create policy exercises_update_self on public.exercises for update to authenticated using(is_custom and created_by=auth.uid()) with check(is_custom and created_by=auth.uid());
create policy exercises_delete_self on public.exercises for delete to authenticated using(is_custom and created_by=auth.uid());
create policy plans_read on public.workout_plans for select to authenticated using(user_id=auth.uid());
create policy plans_insert_self on public.workout_plans for insert to authenticated with check(user_id=auth.uid());
create policy plans_update_self on public.workout_plans for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy plans_delete_self on public.workout_plans for delete to authenticated using(user_id=auth.uid());
create policy plan_exercises_read on public.workout_plan_exercises for select to authenticated using(exists(select 1 from public.workout_plans p where p.id=workout_plan_id and p.user_id=auth.uid()));
create policy plan_exercises_insert_self on public.workout_plan_exercises for insert to authenticated with check(exists(select 1 from public.workout_plans p where p.id=workout_plan_id and p.user_id=auth.uid()));
create policy plan_exercises_update_self on public.workout_plan_exercises for update to authenticated using(exists(select 1 from public.workout_plans p where p.id=workout_plan_id and p.user_id=auth.uid())) with check(exists(select 1 from public.workout_plans p where p.id=workout_plan_id and p.user_id=auth.uid()));
create policy plan_exercises_delete_self on public.workout_plan_exercises for delete to authenticated using(exists(select 1 from public.workout_plans p where p.id=workout_plan_id and p.user_id=auth.uid()));
create policy schedules_read on public.recurring_schedules for select to authenticated using(user_id=auth.uid());
create policy schedules_insert_self on public.recurring_schedules for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.workout_plans p where p.id=workout_plan_id and p.user_id=auth.uid()));
create policy schedules_update_self on public.recurring_schedules for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy schedules_delete_self on public.recurring_schedules for delete to authenticated using(user_id=auth.uid());
create policy scheduled_read on public.scheduled_workouts for select to authenticated using(user_id=auth.uid());
create policy scheduled_insert_self on public.scheduled_workouts for insert to authenticated with check(user_id=auth.uid());
create policy scheduled_update_self on public.scheduled_workouts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy scheduled_delete_self on public.scheduled_workouts for delete to authenticated using(user_id=auth.uid());
create policy sessions_read on public.workout_sessions for select to authenticated using(true);
create policy sessions_insert_self on public.workout_sessions for insert to authenticated with check(user_id=auth.uid());
create policy sessions_update_self on public.workout_sessions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy sessions_delete_self on public.workout_sessions for delete to authenticated using(user_id=auth.uid());
create policy session_exercises_read on public.session_exercises for select to authenticated using(exists(select 1 from public.workout_sessions s where s.id=session_id));
create policy session_exercises_insert_self on public.session_exercises for insert to authenticated with check(exists(select 1 from public.workout_sessions s where s.id=session_id and s.user_id=auth.uid()));
create policy session_exercises_update_self on public.session_exercises for update to authenticated using(exists(select 1 from public.workout_sessions s where s.id=session_id and s.user_id=auth.uid())) with check(exists(select 1 from public.workout_sessions s where s.id=session_id and s.user_id=auth.uid()));
create policy session_exercises_delete_self on public.session_exercises for delete to authenticated using(exists(select 1 from public.workout_sessions s where s.id=session_id and s.user_id=auth.uid()));
create policy sets_read on public.exercise_sets for select to authenticated using(exists(select 1 from public.session_exercises e join public.workout_sessions s on s.id=e.session_id where e.id=session_exercise_id));
create policy sets_insert_self on public.exercise_sets for insert to authenticated with check(exists(select 1 from public.session_exercises e join public.workout_sessions s on s.id=e.session_id where e.id=session_exercise_id and s.user_id=auth.uid()));
create policy sets_update_self on public.exercise_sets for update to authenticated using(exists(select 1 from public.session_exercises e join public.workout_sessions s on s.id=e.session_id where e.id=session_exercise_id and s.user_id=auth.uid())) with check(exists(select 1 from public.session_exercises e join public.workout_sessions s on s.id=e.session_id where e.id=session_exercise_id and s.user_id=auth.uid()));
create policy sets_delete_self on public.exercise_sets for delete to authenticated using(exists(select 1 from public.session_exercises e join public.workout_sessions s on s.id=e.session_id where e.id=session_exercise_id and s.user_id=auth.uid()));

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles,public.exercises,public.workout_plans,public.workout_plan_exercises,public.recurring_schedules,public.scheduled_workouts,public.workout_sessions,public.session_exercises,public.exercise_sets to authenticated;
