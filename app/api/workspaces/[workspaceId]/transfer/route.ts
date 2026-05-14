import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createWorkspaceService } from "@/lib/workspaces/workspace-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * POST /api/workspaces/[workspaceId]/transfer
 * Transfer workspace ownership to another member. Requires owner role.
 * Body: { newOwnerId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const insforge = createClient();
  const {
    data: { user },
    error: authError,
  } = await insforge.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }

  const { workspaceId } = params;

  // Check membership (owner only can transfer ownership)
  const role = await resolveWorkspaceRole(insforge, user.id, workspaceId);
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

  let body: { newOwnerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { newOwnerId } = body;
  if (!newOwnerId || typeof newOwnerId !== "string" || newOwnerId.trim().length === 0) {
    return NextResponse.json(
      { error: "Bad Request", message: "newOwnerId is required" },
      { status: 400 }
    );
  }

  try {
    const workspaceService = createWorkspaceService(insforge);
    await workspaceService.transferOwnership(workspaceId, newOwnerId.trim());
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to transfer ownership";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
