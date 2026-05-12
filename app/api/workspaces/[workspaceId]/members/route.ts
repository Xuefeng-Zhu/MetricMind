import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createWorkspaceService, Role } from "@/lib/workspaces/workspace-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * GET /api/workspaces/[workspaceId]/members
 * List all members of a workspace. Requires viewer+ role.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

  const { workspaceId } = params;

  // Check membership (viewer+ can list members)
  const role = await resolveWorkspaceRole(supabase, user.id, workspaceId);
  if (!role) {
    return NextResponse.json(
      { error: "Forbidden", message: "You are not a member of this workspace" },
      { status: 403 }
    );
  }

  if (!hasPermission(role, "viewer")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: viewer, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  try {
    const { data: members, error } = await supabase
      .from("workspace_members")
      .select("id, workspace_id, user_id, role, invited_at")
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ members: members ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list members";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/members
 * Invite a new member to the workspace. Requires admin+ role.
 * Body: { email: string, role: Role }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

  const { workspaceId } = params;

  // Check membership (admin+ can invite members)
  const role = await resolveWorkspaceRole(supabase, user.id, workspaceId);
  if (!role) {
    return NextResponse.json(
      { error: "Forbidden", message: "You are not a member of this workspace" },
      { status: 403 }
    );
  }

  if (!hasPermission(role, "admin")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: admin, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  let body: { email?: string; role?: Role };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { email, role: memberRole } = body;

  if (!email || typeof email !== "string" || email.trim().length === 0) {
    return NextResponse.json(
      { error: "Bad Request", message: "Email is required" },
      { status: 400 }
    );
  }

  const validRoles: Role[] = ["admin", "analyst", "viewer"];
  if (!memberRole || !validRoles.includes(memberRole)) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "Role must be one of: admin, analyst, viewer",
      },
      { status: 400 }
    );
  }

  try {
    const workspaceService = createWorkspaceService(supabase);
    const membership = await workspaceService.inviteMember(
      workspaceId,
      email.trim(),
      memberRole
    );

    // Audit log: member invited (non-blocking)
    try {
      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        action: "member.invited",
        target_type: "workspace_member",
        target_id: membership.id,
        metadata: { email: email.trim(), role: memberRole },
      });
    } catch {
      // Audit logging should not break the main flow
    }

    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to invite member";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
