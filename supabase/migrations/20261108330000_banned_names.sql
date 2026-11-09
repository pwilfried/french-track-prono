-- One list of banned words for public league names and pseudos (#344).
-- Same rules as src/domain/banned-names.ts: accents ignored, camelCase split,
-- letters typed apart read as one word, links refused.

create function is_banned_name(p_name text) returns boolean
language plpgsql stable set search_path = public, extensions as $$
declare
  v_plain text := lower(extensions.unaccent(regexp_replace(p_name, '([a-z])([A-Z])', '\1 \2', 'g')));
  v_words text[] := '{}';
  v_token text;
  v_previous text := '';
begin
  if v_plain ~ '[a-z0-9-]+\.(com|fr|net|org|io|be|ch|info|bet)\M' then
    return true;
  end if;
  foreach v_token in array regexp_split_to_array(v_plain, '[^a-z0-9]+') loop
    continue when v_token = '';
    if length(v_token) = 1 and length(v_previous) = 1 then
      v_words[cardinality(v_words)] := v_words[cardinality(v_words)] || v_token;
    else
      v_words := v_words || v_token;
    end if;
    v_previous := v_token;
  end loop;
  return exists (
    select 1 from unnest(v_words) w
    where w = any(array['con', 'cons', 'pd', 'fdp', 'ntm', 'ffa', 'www', 'http', 'https', 'pute', 'putes'])
       or w ~ '^(officiel|connard|encul|salop|merde|niqu|batard)'
  );
end $$;

create or replace function is_banned_league_name(p_name text) returns boolean
language sql stable set search_path = public as $$
  select is_banned_name(p_name)
$$;

-- A pseudo is seen by every player: refused when banned.
create function refuse_banned_pseudo() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_banned_name(new.pseudo) then
    raise exception 'banned pseudo' using errcode = 'FT013';
  end if;
  return new;
end $$;

create trigger profiles_refuse_banned_pseudo
before insert or update of pseudo on profiles
for each row execute function refuse_banned_pseudo();
