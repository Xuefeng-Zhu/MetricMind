import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDataSourceService } from "@/lib/data-sources/data-source-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/data-sources
 * List all data sources for the workspace.
 * Requires analyst+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
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
    const dataSourceService = createDataSourceService(supabase);
    const dataSources = await dataSourceService.getDataSources(workspaceId);
    return NextResponse.json({ dataSources });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list data sources";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-sources
 * Upload a CSV file as a new data source.
 * Requires analyst+ role.
 * Accepts multipart form data with a "file" field.
 * Workspace ID from x-workspace-id header or workspaceId query param.
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

  if (!hasPermission(role, "analyst")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: analyst, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid form data. Expected multipart/form-data with a file field." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Bad Request", message: "A CSV file is required in the 'file' field." },
      { status: 400 }
    );
  }

  // Validate file type (basic check)
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      { error: "Bad Request", message: "Only CSV files are supported." },
      { status: 400 }
    );
  }

  try {
    const dataSourceService = createDataSourceService(supabase);
    const dataSource = await dataSourceService.uploadCSV(workspaceId, file);

    // Audit log: data source created (non-blocking)
    try {
      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        action: "datasource.created",
        target_type: "data_source",
        target_id: dataSource.id,
        metadata: { file_name: file.name },
      });
    } catch {
      // Audit logging should not break the main flow
    }

    return NextResponse.json({ dataSource }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload data source";

    // Check if it's a file size error
    if (message.includes("exceeds maximum allowed size")) {
      return NextResponse.json(
        { error: "Bad Request", message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
