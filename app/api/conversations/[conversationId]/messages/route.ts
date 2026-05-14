import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createConversationService } from "@/lib/conversations/conversation-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

interface RouteParams {
  params: { conversationId: string };
}

/**
 * GET /api/conversations/[conversationId]/messages
 * Get all messages for a conversation.
 * Requires viewer+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 *
 * Requirements: 22.2
 */
export async function GET(
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

  const { conversationId } = params;

  if (!conversationId) {
    return NextResponse.json(
      { error: "Bad Request", message: "Conversation ID is required" },
      { status: 400 }
    );
  }

  try {
    const conversationService = createConversationService(insforge);

    // Verify the conversation exists and belongs to this workspace/user
    const conversation = await conversationService.getConversation(conversationId);
    if (conversation.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "Not Found", message: "Conversation not found" },
        { status: 404 }
      );
    }
    if (conversation.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden", message: "You do not have access to this conversation" },
        { status: 403 }
      );
    }

    const messages = await conversationService.getMessages(conversationId);
    return NextResponse.json({ messages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch messages";

    // Handle not found errors from the service
    if (message.includes("Failed to fetch conversation")) {
      return NextResponse.json(
        { error: "Not Found", message: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
