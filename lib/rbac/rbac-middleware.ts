import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "analyst" | "viewer";

export interface RBACContext {
  userId: string;
  workspaceId: string;
  role: Role;
}

export interface RBACMiddlewareOptions {
  requiredRole: Role;
}

/**
 * Role hierarchy levels. Higher number = more permissions.
 * owner > admin > analyst > viewer
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  analyst: 2,
  viewer: 1,
};

/**
 * Checks if a user's role meets or exceeds the required role level.
 * Uses the role hierarchy: owner > admin > analyst > viewer.
 */
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Resolves the user's role within a specific workspace by querying workspace_members.
 * Returns null if the user is not a member of the workspace.
 */
export async function resolveWorkspaceRole(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string
): Promise<Role | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role as Role;
}

/**
 * Extracts the workspace ID from the request.
 * Checks in order:
 * 1. Request header `x-workspace-id` (preferred)
 * 2. Query parameter `workspaceId`
 */
function extractWorkspaceId(req: NextRequest): string | null {
  // Check header first (preferred)
  const headerWorkspaceId = req.headers.get("x-workspace-id");
  if (headerWorkspaceId) {
    return headerWorkspaceId;
  }

  // Fall back to query parameter
  const url = new URL(req.url);
  const queryWorkspaceId = url.searchParams.get("workspaceId");
  if (queryWorkspaceId) {
    return queryWorkspaceId;
  }

  return null;
}

/**
 * RBAC middleware that checks workspace membership and role
 * before allowing API route handlers to proceed.
 *
 * Usage:
 *   export const POST = withRBAC({ requiredRole: 'analyst' }, handler);
 */
export function withRBAC(
  options: RBACMiddlewareOptions,
  handler: (req: NextRequest, context: RBACContext) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    // 1. Get the authenticated user from Supabase session
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Get the workspaceId from the request
    const workspaceId = extractWorkspaceId(req);
    if (!workspaceId) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Workspace ID is required. Provide it via x-workspace-id header or workspaceId query parameter.",
        },
        { status: 400 }
      );
    }

    // 3. Resolve the user's role in that workspace
    const role = await resolveWorkspaceRole(supabase, user.id, workspaceId);
    if (!role) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You are not a member of this workspace",
        },
        { status: 403 }
      );
    }

    // 4. Check if the role meets the required level
    if (!hasPermission(role, options.requiredRole)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: `Permission denied. Required role: ${options.requiredRole}, your role: ${role}`,
        },
        { status: 403 }
      );
    }

    // 5. Call the handler with the RBACContext
    const context: RBACContext = {
      userId: user.id,
      workspaceId,
      role,
    };

    return handler(req, context);
  };
}
