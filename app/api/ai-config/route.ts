import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/ai-config
 * Retrieve the workspace's AI provider configuration.
 * Returns endpoint_url and model_name only — NEVER returns the API key.
 * Requires owner role.
 * Workspace ID from x-workspace-id header.
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

  const workspaceId = request.headers.get("x-workspace-id");

  if (!workspaceId) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message:
          "Workspace ID is required. Provide it via x-workspace-id header.",
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
    const { data, error } = await supabase
      .from("ai_provider_configs")
      .select("id, workspace_id, endpoint_url, model_name, created_at")
      .eq("workspace_id", workspaceId)
      .single();

    if (error && error.code === "PGRST116") {
      // No config found — not an error, just no config yet
      return NextResponse.json({ config: null });
    }

    if (error) {
      return NextResponse.json(
        { error: "Internal Server Error", message: "Failed to retrieve AI provider config" },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve AI provider config";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai-config
 * Create or update the workspace's AI provider configuration.
 * Uses upsert (insert on conflict update) since workspace_id has a unique constraint.
 * Requires owner role.
 * Workspace ID from x-workspace-id header.
 * Body: { endpointUrl: string, modelName: string, apiKey: string }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
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

  const workspaceId = request.headers.get("x-workspace-id");

  if (!workspaceId) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message:
          "Workspace ID is required. Provide it via x-workspace-id header.",
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

  if (!hasPermission(role, "owner")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: owner, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  // Parse and validate request body
  let body: { endpointUrl?: string; modelName?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { endpointUrl, modelName, apiKey } = body;

  if (!endpointUrl || typeof endpointUrl !== "string" || endpointUrl.trim() === "") {
    return NextResponse.json(
      { error: "Bad Request", message: "endpointUrl is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  if (!modelName || typeof modelName !== "string" || modelName.trim() === "") {
    return NextResponse.json(
      { error: "Bad Request", message: "modelName is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    return NextResponse.json(
      { error: "Bad Request", message: "apiKey is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  try {
    // Upsert: insert or update on workspace_id conflict
    const { data, error } = await supabase
      .from("ai_provider_configs")
      .upsert(
        {
          workspace_id: workspaceId,
          endpoint_url: endpointUrl.trim(),
          model_name: modelName.trim(),
          encrypted_api_key: apiKey,
        },
        { onConflict: "workspace_id" }
      )
      .select("id, workspace_id, endpoint_url, model_name, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Internal Server Error", message: "Failed to save AI provider config" },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save AI provider config";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
