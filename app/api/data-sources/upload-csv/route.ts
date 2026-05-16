import { NextRequest, NextResponse } from "next/server";

import { toActionResult, uploadCsvDataset } from "@/lib/data-sources/service";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid multipart form data." },
      { status: 400 }
    );
  }

  const workspaceId =
    request.headers.get("x-workspace-id") ||
    formData.get("workspaceId")?.toString() ||
    new URL(request.url).searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "Bad Request", message: "workspaceId is required." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Bad Request", message: "A CSV file is required in the file field." },
      { status: 400 }
    );
  }

  const result = await toActionResult(() => uploadCsvDataset({ workspaceId, file }));

  if (!result.ok) {
    const status = result.status === 500 && /CSV|file|empty|Only/.test(result.error)
      ? 400
      : result.status;
    return NextResponse.json(
      {
        error:
          status === 400
            ? "Bad Request"
            : status === 401
              ? "Unauthorized"
              : status === 403
                ? "Forbidden"
                : "Internal Server Error",
        message: result.error,
      },
      { status }
    );
  }

  const { dataSource, uploadedFile, dataset, columns, profile, suggestions, pageData } =
    result.data;

  return NextResponse.json(
    {
      dataSource,
      uploadedFile,
      dataset,
      columns,
      profile,
      suggestions,
      pageData,
    },
    { status: 201 }
  );
}
