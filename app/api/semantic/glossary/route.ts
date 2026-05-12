import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSemanticLayerService } from "@/lib/semantic/semantic-layer-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/semantic/glossary
 * List all glossary terms for the workspace.
 * Requires analyst+ role.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const role = await resolveWorkspaceRole(supabase, user.id, workspaceId);
  if (!role) {
    return NextResponse.json(
      { error: "Forbidden", message: "You are not a member of this workspace" },
      { status: 403 }
    );
  }

  if (!hasPermission(role, "analyst")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: analyst, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  try {
    const service = createSemanticLayerService(supabase);
    const terms = await service.getGlossaryTerms(workspaceId);
    return NextResponse.json({ terms });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list glossary terms";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/semantic/glossary
 * Create a new glossary term.
 * Requires admin+ role.
 * Body: { name, definition, relatedMetricIds?, relatedEntityIds? }
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

  let body: {
    name?: string;
    definition?: string;
    relatedMetricIds?: string[];
    relatedEntityIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.name || !body.definition) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "name and definition are required",
      },
      { status: 400 }
    );
  }

  try {
    const service = createSemanticLayerService(supabase);
    const term = await service.createGlossaryTerm(workspaceId, {
      name: body.name,
      definition: body.definition,
      relatedMetricIds: body.relatedMetricIds,
      relatedEntityIds: body.relatedEntityIds,
    });
    return NextResponse.json({ term }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create glossary term";
    if (message.includes("already exists")) {
      return NextResponse.json(
        { error: "Conflict", message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
