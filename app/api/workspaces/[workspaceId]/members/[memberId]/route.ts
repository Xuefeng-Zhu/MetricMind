import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createWorkspaceService, Role } from "@/lib/workspaces/workspace-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

interface RouteParams {
  params: { workspaceId: string; memberId: string };
}

/**
 * PATCH /api/workspaces/[workspaceId]/members/[memberId]
 * Update a member's role. Requires owner role.
 * Body: { role: Role }
 */
export async function PATCH(
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

  const { workspaceId, memberId } = params;

  // Check membership (owner only can update roles)
  const role = await resolveWorkspaceRole(supabase, user.id, workspaceId);
  if (!role) {
    return NextResponse.json(
      { error: "Forbidden", message: "You are not a member of this workspace" },
      { status: 403 }
    );
  }

  if (!hasPermission(role, "owner")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: owner, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  let body: { role?: Role };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { role: newRole } = body;
  const validRoles: Role[] = ["admin", "analyst", "viewer"];
  if (!newRole || !validRoles.includes(newRole)) {
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
    const membership = await workspaceService.updateMemberRole(
      workspaceId,
      memberId,
      newRole
    );

    // Audit log: member role changed (non-blocking)
    try {
      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        action: "member.role_changed",
        target_type: "workspace_member",
        target_id: memberId,
        metadata: { new_role: newRole },
      });
    } catch {
      // Audit logging should not break the main flow
    }

    return NextResponse.json({ membership });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update member role";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/members/[memberId]
 * Remove a member from the workspace. Requires owner role.
 */
export async function DELETE(
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

  const { workspaceId, memberId } = params;

  // Check membership (owner only can remove members)
  const role = await resolveWorkspaceRole(supabase, user.id, workspaceId);
  if (!role) {
    return NextResponse.json(
      { error: "Forbidden", message: "You are not a member of this workspace" },
      { status: 403 }
    );
  }

  if (!hasPermission(role, "owner")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: owner, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  try {
    const workspaceService = createWorkspaceService(supabase);
    await workspaceService.removeMember(workspaceId, memberId);

    // Audit log: member removed (non-blocking)
    try {
      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        action: "member.removed",
        target_type: "workspace_member",
        target_id: memberId,
        metadata: {},
      });
    } catch {
      // Audit logging should not break the main flow
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove member";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
