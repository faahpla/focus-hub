-- =============================================================================
-- Focus HUB — quadros compartilhados
--
-- COMO USAR: no painel do Supabase, abra "SQL Editor", cole este arquivo
-- inteiro e clique em "Run". Pode rodar de novo sem medo: nada é duplicado.
--
-- O QUE VIVE AQUI: só os quadros que você escolhe compartilhar, os cards
-- deles e quem tem acesso. Finanças, sessões, projetos e quadros não
-- compartilhados nunca saem do seu PC.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Ids are text, not uuid: the app's uid() falls back to a non-uuid format when
-- crypto.randomUUID is missing, and a shared card must keep the id it already
-- has locally.
create table if not exists public.boards (
  id          text primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  icon        text not null default 'KanbanSquare',
  color       text not null default '270 80% 66%',
  description text,
  -- Columns live inline on the board in the app, so they do here too.
  columns     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Permission flags are the authority; `role` is the label the screen shows.
-- An editor is someone with every flag on, and the check keeps the two honest.
create table if not exists public.board_members (
  board_id           text not null references public.boards (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  email              text not null,
  role               text not null default 'editor' check (role in ('editor', 'custom')),
  can_create_cards   boolean not null default true,
  can_delete_cards   boolean not null default true,
  can_manage_columns boolean not null default true,
  created_at         timestamptz not null default now(),
  primary key (board_id, user_id),
  check (role <> 'editor' or (can_create_cards and can_delete_cards and can_manage_columns))
);

-- Access is granted by a one-time code the owner sends over chat, not by
-- e-mail. Supabase's built-in mailer only delivers to the project's own team,
-- so an invite e-mail would never reach the editor; and with sign-up
-- confirmation off, e-mail ownership is not proven anyway. The code is what
-- proves the owner meant this person. Single use, expires in a week.
create table if not exists public.board_invites (
  code               text primary key,
  board_id           text not null references public.boards (id) on delete cascade,
  role               text not null default 'editor' check (role in ('editor', 'custom')),
  can_create_cards   boolean not null default true,
  can_delete_cards   boolean not null default true,
  can_manage_columns boolean not null default true,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '7 days',
  check (role <> 'editor' or (can_create_cards and can_delete_cards and can_manage_columns))
);

-- Everything a card carries besides its place sits in `data`, one key per
-- field. Writes go through patch_card, which merges key by key — so two people
-- editing different fields of the same card never overwrite each other, and a
-- field added to the app tomorrow needs no migration here.
create table if not exists public.cards (
  id          text primary key,
  board_id    text not null references public.boards (id) on delete cascade,
  column_id   text not null,
  sort_order  integer not null default 0,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);

create index if not exists cards_board_idx on public.cards (board_id);
create index if not exists board_members_user_idx on public.board_members (user_id);
create index if not exists board_invites_board_idx on public.board_invites (board_id);


-- -----------------------------------------------------------------------------
-- Permission helpers
--
-- SECURITY DEFINER so the policies below can ask about membership without
-- re-entering the policies on board_members (which would recurse).
-- -----------------------------------------------------------------------------

create or replace function public.is_board_owner(b text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from boards where id = b and owner_id = auth.uid())
$$;

create or replace function public.board_can(b text, perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_board_owner(b) or exists (
    select 1
    from board_members m
    where m.board_id = b
      and m.user_id = auth.uid()
      and case perm
            when 'read'           then true
            when 'edit'           then true
            when 'create_cards'   then m.can_create_cards
            when 'delete_cards'   then m.can_delete_cards
            when 'manage_columns' then m.can_manage_columns
            else false
          end
  )
$$;


-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.boards        enable row level security;
alter table public.board_members enable row level security;
alter table public.board_invites enable row level security;
alter table public.cards         enable row level security;

-- Nothing here is for anonymous visitors.
revoke all on public.boards, public.board_members, public.board_invites, public.cards from anon;

-- boards ----------------------------------------------------------------------
drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards
  for select to authenticated using (public.board_can(id, 'read'));

drop policy if exists boards_insert on public.boards;
create policy boards_insert on public.boards
  for insert to authenticated with check (owner_id = auth.uid());

-- Members change columns through set_board_columns, which checks their flag;
-- the board's name, icon and colour stay the owner's.
drop policy if exists boards_update on public.boards;
create policy boards_update on public.boards
  for update to authenticated
  using (public.is_board_owner(id)) with check (public.is_board_owner(id));

drop policy if exists boards_delete on public.boards;
create policy boards_delete on public.boards
  for delete to authenticated using (public.is_board_owner(id));

-- board_members ---------------------------------------------------------------
-- Everyone on a board can see who else is on it.
drop policy if exists members_select on public.board_members;
create policy members_select on public.board_members
  for select to authenticated using (public.board_can(board_id, 'read'));

drop policy if exists members_update on public.board_members;
create policy members_update on public.board_members
  for update to authenticated
  using (public.is_board_owner(board_id)) with check (public.is_board_owner(board_id));

-- The owner removes people; anyone can remove themselves (leave the board).
drop policy if exists members_delete on public.board_members;
create policy members_delete on public.board_members
  for delete to authenticated
  using (public.is_board_owner(board_id) or user_id = auth.uid());

-- Inserting a membership goes through join_board only: a code from the owner.

-- board_invites ---------------------------------------------------------------
drop policy if exists invites_select on public.board_invites;
create policy invites_select on public.board_invites
  for select to authenticated using (public.is_board_owner(board_id));

drop policy if exists invites_delete on public.board_invites;
create policy invites_delete on public.board_invites
  for delete to authenticated using (public.is_board_owner(board_id));

-- cards -----------------------------------------------------------------------
drop policy if exists cards_select on public.cards;
create policy cards_select on public.cards
  for select to authenticated using (public.board_can(board_id, 'read'));

drop policy if exists cards_insert on public.cards;
create policy cards_insert on public.cards
  for insert to authenticated with check (public.board_can(board_id, 'create_cards'));

-- WITH CHECK runs on the row as it will be, so moving a card to another board
-- also requires access to the destination.
drop policy if exists cards_update on public.cards;
create policy cards_update on public.cards
  for update to authenticated
  using (public.board_can(board_id, 'edit')) with check (public.board_can(board_id, 'edit'));

drop policy if exists cards_delete on public.cards;
create policy cards_delete on public.cards
  for delete to authenticated using (public.board_can(board_id, 'delete_cards'));


-- -----------------------------------------------------------------------------
-- Timestamps
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists boards_touch on public.boards;
create trigger boards_touch before update on public.boards
  for each row execute function public.touch_updated_at();

drop trigger if exists cards_touch on public.cards;
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();


-- -----------------------------------------------------------------------------
-- Operations the app calls
-- -----------------------------------------------------------------------------

-- Per-field write. Only the keys that changed travel: `fields` are merged in,
-- `removed` are dropped (a field the app cleared, like a due date). SECURITY
-- INVOKER, so the cards_update policy above still decides who may do it.
create or replace function public.patch_card(
  card_id    text,
  fields     jsonb   default '{}'::jsonb,
  removed    text[]  default '{}',
  new_column text    default null,
  new_order  integer default null,
  new_board  text    default null
)
returns void
language sql security invoker set search_path = public
as $$
  update cards
     set data       = (data - removed) || fields,
         column_id  = coalesce(new_column, column_id),
         sort_order = coalesce(new_order, sort_order),
         board_id   = coalesce(new_board, board_id),
         updated_by = auth.uid()
   where id = card_id
$$;

-- Columns are the one part of a board members may change, and only with the
-- flag for it.
create or replace function public.set_board_columns(b text, cols jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.board_can(b, 'manage_columns') then
    raise exception 'sem permissao para mexer nas colunas' using errcode = '42501';
  end if;
  update boards set columns = cols where id = b;
end
$$;

-- Make a one-time invite code for a board. Owner only. The code is twelve hex
-- characters in three groups (48 bits): readable aloud, easy to paste, and far
-- too many combinations to guess one before it expires.
create or replace function public.create_invite(
  b           text,
  member_role text    default 'editor',
  can_create  boolean default true,
  can_delete  boolean default true,
  can_manage  boolean default true
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  editor boolean := member_role = 'editor';
  raw    text;
  c      text;
begin
  if not public.is_board_owner(b) then
    raise exception 'so o dono do quadro pode convidar' using errcode = '42501';
  end if;

  raw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  c   := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);

  insert into board_invites
    (code, board_id, role, can_create_cards, can_delete_cards, can_manage_columns)
  values
    (c, b, member_role, editor or can_create, editor or can_delete, editor or can_manage);
  return c;
end
$$;

-- Redeem a code: the signed-in user joins the board with the permissions the
-- owner chose, and the code is spent. Returns the board id. An expired code is
-- only refused, not deleted — raising rolls back any delete in the same call —
-- so it lingers in the owner's list until revoked.
create or replace function public.join_board(invite_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  inv      board_invites%rowtype;
  me       uuid := auth.uid();
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if me is null then
    raise exception 'entre na sua conta antes de usar um convite' using errcode = '42501';
  end if;

  select * into inv
    from board_invites
   where code = upper(trim(invite_code))
   for update;

  if not found then
    raise exception 'convite nao encontrado' using errcode = '22023';
  end if;
  if inv.expires_at < now() then
    raise exception 'convite expirado - peca um novo' using errcode = '22023';
  end if;
  if public.is_board_owner(inv.board_id) then
    raise exception 'voce ja e o dono deste quadro' using errcode = '22023';
  end if;

  insert into board_members
    (board_id, user_id, email, role, can_create_cards, can_delete_cards, can_manage_columns)
  values
    (inv.board_id, me, my_email, inv.role,
     inv.can_create_cards, inv.can_delete_cards, inv.can_manage_columns)
  on conflict (board_id, user_id) do update
    set role               = excluded.role,
        can_create_cards   = excluded.can_create_cards,
        can_delete_cards   = excluded.can_delete_cards,
        can_manage_columns = excluded.can_manage_columns;

  delete from board_invites where code = inv.code;
  return inv.board_id;
end
$$;

-- Change what a member may do, or switch them between editor and custom.
create or replace function public.set_member_permissions(
  b           text,
  member      uuid,
  member_role text,
  can_create  boolean,
  can_delete  boolean,
  can_manage  boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  editor boolean := member_role = 'editor';
begin
  if not public.is_board_owner(b) then
    raise exception 'so o dono do quadro muda permissoes' using errcode = '42501';
  end if;
  update board_members
     set role               = member_role,
         can_create_cards   = editor or can_create,
         can_delete_cards   = editor or can_delete,
         can_manage_columns = editor or can_manage
   where board_id = b and user_id = member;
end
$$;

revoke execute on function
  public.is_board_owner(text),
  public.board_can(text, text),
  public.patch_card(text, jsonb, text[], text, integer, text),
  public.set_board_columns(text, jsonb),
  public.create_invite(text, text, boolean, boolean, boolean),
  public.join_board(text),
  public.set_member_permissions(text, uuid, text, boolean, boolean, boolean)
from public, anon;

grant execute on function
  public.is_board_owner(text),
  public.board_can(text, text),
  public.patch_card(text, jsonb, text[], text, integer, text),
  public.set_board_columns(text, jsonb),
  public.create_invite(text, text, boolean, boolean, boolean),
  public.join_board(text),
  public.set_member_permissions(text, uuid, text, boolean, boolean, boolean)
to authenticated;


-- -----------------------------------------------------------------------------
-- Realtime: changes made by one person reach the other in seconds.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['boards', 'cards', 'board_members'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
