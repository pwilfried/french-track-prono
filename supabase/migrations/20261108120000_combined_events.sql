-- Combined events (v0.8, minimal): a decathlon, heptathlon or pentathlon is one event whose
-- podium players predict, like a single event; its disciplines are listed in order.
alter table events
  add column kind text not null default 'solo' check (kind in ('solo', 'combined')),
  add column sub_disciplines text[] not null default '{}',
  add constraint combined_has_disciplines
    check ((kind = 'combined') = (cardinality(sub_disciplines) > 0));
