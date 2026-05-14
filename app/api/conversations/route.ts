import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createConversationService } from "@/lib/conversations/conversation-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/conversations
 * List all conversations for the authenticated user in the workspace.
 * Requires viewer+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 *
 * Requirements: 22.4
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const workspaceId =
    request.headers.get("x-workspace-id") ||
    new URL(request.url).searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message:
          "Workspace ID is required. Provide it via x-workspace-id header or workspaceId query parameter.",
      },
      { status: 400 }
    );
  }

  const role = await resolveWorkspaceRole(insforge, user.id, workspaceId);
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
    const conversationService = createConversationService(insforge);
    const conversations = await conversationService.getConversations(workspaceId, user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list conversations";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new conversation with an optional title.
 * Requires viewer+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 * Body: { title?: string }
 *
 * Requirements: 22.1
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const workspaceId =
    request.headers.get("x-workspace-id") ||
    new URL(request.url).searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message:
          "Workspace ID is required. Provide it via x-workspace-id header or workspaceId query parameter.",
      },
      { status: 400 }
    );
  }

  const role = await resolveWorkspaceRole(insforge, user.id, workspaceId);
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

  let body: { title?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional; default to empty object
  }

  try {
    const conversationService = createConversationService(insforge);
    const conversation = await conversationService.createConversation(
      workspaceId,
      user.id,
      body.title
    );
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create conversation";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
