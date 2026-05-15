-- Rename previously auto-created default workspaces to the new default label.
--
-- This targets the old untouched fallback name and avoids creating duplicate
-- "Personal" names for owners who already have one.

UPDATE public.workspaces AS workspace
SET name = 'Personal'
WHERE workspace.name = 'My Workspace'
  AND NOT EXISTS (
    SELECT 1
    FROM public.workspaces AS sibling
    WHERE sibling.owner_id = workspace.owner_id
      AND sibling.id <> workspace.id
      AND sibling.name = 'Personal'
  );
