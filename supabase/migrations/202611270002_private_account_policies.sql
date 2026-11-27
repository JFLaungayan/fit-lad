-- The app now treats user accounts as private workspaces. Revoke the initial
-- household-wide read policies and keep every record scoped to its owner.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read_self on public.profiles for select to authenticated using(id=auth.uid());

drop policy if exists sessions_read on public.workout_sessions;
create policy sessions_read_self on public.workout_sessions for select to authenticated using(user_id=auth.uid());

drop policy if exists session_exercises_read on public.session_exercises;
create policy session_exercises_read_self on public.session_exercises for select to authenticated
using(exists(select 1 from public.workout_sessions s where s.id=session_id and s.user_id=auth.uid()));

drop policy if exists sets_read on public.exercise_sets;
create policy sets_read_self on public.exercise_sets for select to authenticated
using(exists(select 1 from public.session_exercises e join public.workout_sessions s on s.id=e.session_id where e.id=session_exercise_id and s.user_id=auth.uid()));
