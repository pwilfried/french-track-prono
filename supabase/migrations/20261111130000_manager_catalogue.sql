-- French Track Manager, v0.13 (#421): the mercato catalogue. The admin gives an athlete a price
-- (the lowest bid, decided by the owner in #441); only athletes with a price are in it. A league's
-- participants read its catalogue: name, sex, main discipline and family, PB and SB in it, price
-- and whether the athlete is still free in the league (always true until the awards of #423).
-- Error codes: 42501 not an admin, or not a participant of the league; 22023 price not above 0.

alter table athletes add column manager_price int check (manager_price > 0);

-- Sets the price of an athlete; null takes them out of the catalogue.
create function admin_set_athlete_price(p_athlete uuid, p_price int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  if p_price is not null and p_price <= 0 then
    raise exception 'a price is above 0' using errcode = '22023';
  end if;
  update athletes set manager_price = p_price where id = p_athlete;
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'manager_price', p_price));
end $$;
revoke execute on function admin_set_athlete_price(uuid, int) from public, anon;
grant execute on function admin_set_athlete_price(uuid, int) to authenticated;

create function manager_catalogue(p_league uuid)
returns table (athlete_id uuid, slug text, name text, country_code text, sex text,
               discipline text, family text, pb text, sb text, price int, available boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant reads the catalogue' using errcode = '42501';
  end if;
  return query
  select a.id, a.slug, a.name, a.country_code::text, a.gender::text, d.name, d.family,
         (select r.mark from athlete_records r
          where r.athlete_id = a.id and r.discipline = d.name and r.kind = 'pr'),
         (select r.mark from athlete_records r
          where r.athlete_id = a.id and r.discipline = d.name and r.kind = 'sb'),
         a.manager_price, true
  from athletes a
  join athlete_disciplines ad on ad.athlete_id = a.id and ad.is_primary
  join disciplines d on d.name = ad.discipline
  where a.manager_price is not null and a.kind = 'athlete' and a.gender in ('F', 'M')
    and d.family <> 'relay'
  order by a.name;
end $$;
revoke execute on function manager_catalogue(uuid) from public, anon;
grant execute on function manager_catalogue(uuid) to authenticated;
