-- Allow a workspace owner to see their newly inserted workspace before the
-- matching owner membership row exists.

DROP POLICY IF EXISTS "workspace_select" ON workspaces;

CREATE POLICY "workspace_select" ON workspaces
  FOR SELECT
  USING (
    id = ANY(public.current_workspace_ids())
    OR owner_id = public.current_profile_id()
  );
