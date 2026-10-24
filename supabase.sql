-- Rode uma vez no Supabase: SQL Editor → New query → Run.
-- Script idempotente: pode ser rodado de novo sem quebrar nada.
-- Usado a partir da fase 2 (placar compartilhado). A fase 1 não depende disto.

create table if not exists public.votes (
  question_id text primary key
    check (question_id ~ '^q[0-9]{3,}$'),
  a int not null default 0,
  b int not null default 0
);

-- Ninguém acessa a tabela direto; só pelas funções abaixo.
alter table public.votes enable row level security;

create or replace function public.cast_vote(q text, side text)
returns table (out_a int, out_b int)
language plpgsql security definer set search_path = public as $$
begin
  if q !~ '^q[0-9]{3,}$' or side not in ('a', 'b') then
    raise exception 'voto inválido';
  end if;

  insert into public.votes (question_id, a, b)
  values (q, (side = 'a')::int, (side = 'b')::int)
  on conflict (question_id) do update
    set a = public.votes.a + (side = 'a')::int,
        b = public.votes.b + (side = 'b')::int;

  return query select v.a, v.b from public.votes v where v.question_id = q;
end $$;

create or replace function public.get_votes(q text)
returns table (out_a int, out_b int)
language sql security definer set search_path = public as $$
  select coalesce(max(v.a), 0), coalesce(max(v.b), 0)
  from public.votes v where v.question_id = q;
$$;

-- Desfaz o último voto (botão Voltar). Nunca deixa o placar negativo.
create or replace function public.undo_vote(q text, side text)
returns table (out_a int, out_b int)
language plpgsql security definer set search_path = public as $$
begin
  if q !~ '^q[0-9]{3,}$' or side not in ('a', 'b') then
    raise exception 'voto inválido';
  end if;

  update public.votes
  set a = greatest(a - (side = 'a')::int, 0),
      b = greatest(b - (side = 'b')::int, 0)
  where question_id = q;

  return query select v.a, v.b from public.votes v where v.question_id = q;
end $$;

grant execute on function public.cast_vote(text, text) to anon;
grant execute on function public.get_votes(text) to anon;
grant execute on function public.undo_vote(text, text) to anon;