-- Fix workspace bootstrap RLS.
--
-- The original workspace_members policy queried workspace_members inside its
-- own predicate, which causes Postgres to raise 42P17 infinite recursion.
-- These SECURITY DEFINER helpers evaluate the current user's profile,
-- workspace memberships, and owned workspaces without re-entering the
-- caller's row-level policy.

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(workspace_id), ARRAY[]::UUID[])
  FROM public.workspace_members
  WHERE user_id = public.current_profile_id();
$$;

CREATE OR REPLACE FUNCTION public.current_owned_workspace_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  FROM public.workspaces
  WHERE owner_id = public.current_profile_id();
$$;

DROP POLICY IF EXISTS "workspace_isolation" ON workspaces;

CREATE POLICY "workspace_select" ON workspaces
  FOR SELECT
  USING (id = ANY(public.current_workspace_ids()));

CREATE POLICY "workspace_insert" ON workspaces
  FOR INSERT
  WITH CHECK (owner_id = public.current_profile_id());

CREATE POLICY "workspace_update" ON workspaces
  FOR UPDATE
  USING (id = ANY(public.current_workspace_ids()))
  WITH CHECK (id = ANY(public.current_workspace_ids()));

CREATE POLICY "workspace_delete" ON workspaces
  FOR DELETE
  USING (id = ANY(public.current_workspace_ids()));

DROP POLICY IF EXISTS "workspace_isolation" ON workspace_members;

CREATE POLICY "workspace_members_select" ON workspace_members
  FOR SELECT
  USING (workspace_id = ANY(public.current_workspace_ids()));

CREATE POLICY "workspace_members_insert" ON workspace_members
  FOR INSERT
  WITH CHECK (
    workspace_id = ANY(public.current_workspace_ids())
    OR (
      workspace_id = ANY(public.current_owned_workspace_ids())
      AND user_id = public.current_profile_id()
      AND role = 'owner'
    )
  );

CREATE POLICY "workspace_members_update" ON workspace_members
  FOR UPDATE
  USING (workspace_id = ANY(public.current_workspace_ids()))
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids()));

CREATE POLICY "workspace_members_delete" ON workspace_members
  FOR DELETE
  USING (workspace_id = ANY(public.current_workspace_ids()));
