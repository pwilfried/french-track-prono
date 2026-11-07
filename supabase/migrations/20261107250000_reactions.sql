-- Reactions (v0.6): one emoji per player on someone else's prediction, once the event is locked.
-- Fixed list, no free text (non-goal: no chat). Decided by the owner (issue #16).
create table reactions (
  prediction_id uuid not null references predictions(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  emoji         text not null check (emoji in ('🔥', '😂', '😮', '👏', '🤡', '🎯')),
  created_at    timestamptz not null default now(),
  primary key (prediction_id, user_id)
);
create index on reactions (prediction_id);

alter table reactions enable row level security;

-- True when the signed-in player may react to this prediction: its event is locked and it is not
-- his own. Security definer: it reads the prediction whatever the caller may see.
create function can_react(p_prediction uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from predictions p join events e on e.id = p.event_id
    where p.id = p_prediction and e.lock_at <= now() and p.user_id <> auth.uid()
  )
$$;

-- Reactions only exist on locked predictions, which every signed-in player can read.
create policy read_all on reactions for select to authenticated using (true);
create policy react on reactions for insert to authenticated
  with check (user_id = auth.uid() and can_react(prediction_id));
create policy change_own on reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and can_react(prediction_id));
create policy remove_own on reactions for delete to authenticated using (user_id = auth.uid());
