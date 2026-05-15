import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { createClient } from "@/lib/insforge/server";
import { createWorkspaceService } from "@/lib/workspaces/workspace-service";

/**
 * GET /api/workspaces
 * List all workspaces the authenticated user belongs to.
 * Any authenticated user can access this.
 */
export async function GET(): Promise<NextResponse> {
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

  try {
    const profile = await ensureProfile(insforge, user);
    const workspaceService = createWorkspaceService(insforge);
    const workspaces = await workspaceService.getByUser(profile.id);
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
    const profile = await ensureProfile(insforge, user);
    const workspaceService = createWorkspaceService(insforge);
    const workspace = await workspaceService.create(name.trim(), profile.id);
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
