import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createWorkspaceService } from "@/lib/workspaces/workspace-service";

/**
 * GET /api/workspaces
 * List all workspaces the authenticated user belongs to.
 * Any authenticated user can access this.
 */
export async function GET(): Promise<NextResponse> {
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

  try {
    const workspaceService = createWorkspaceService(supabase);
    const workspaces = await workspaceService.getByUser(user.id);
    return NextResponse.json({ workspaces });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list workspaces";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces
 * Create a new workspace. Any authenticated user can create a workspace.
 * Body: { name: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { name } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Bad Request", message: "Workspace name is required" },
      { status: 400 }
    );
  }

  try {
    const workspaceService = createWorkspaceService(supabase);
    const workspace = await workspaceService.create(name.trim(), user.id);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create workspace";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
