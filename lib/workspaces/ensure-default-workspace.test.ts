import { describe, expect, it, vi } from "vitest";

import { ensureDefaultWorkspace } from "./ensure-default-workspace";
import { createWorkspaceService } from "./workspace-service";

const mockCreateWorkspaceService = vi.hoisted(() => vi.fn());

vi.mock("./workspace-service", () => ({
  createWorkspaceService: mockCreateWorkspaceService,
}));

describe("ensureDefaultWorkspace", () => {
  it("returns the first existing workspace", async () => {
    const workspace = {
      id: "ws-1",
      name: "Existing Workspace",
      created_at: "2026-05-14T00:00:00Z",
      owner_id: "user-1",
      role: "owner",
    };
    const create = vi.fn();
    mockCreateWorkspaceService.mockReturnValue({
      getByUser: vi.fn().mockResolvedValue([workspace]),
      create,
    });

    const result = await ensureDefaultWorkspace({} as any, "user-1");

    expect(result).toBe(workspace);
    expect(create).not.toHaveBeenCalled();
    expect(createWorkspaceService).toHaveBeenCalledWith({});
  });

  it("creates Personal when the user has none", async () => {
    const workspace = {
      id: "ws-new",
      name: "Personal",
      created_at: "2026-05-14T00:00:00Z",
      owner_id: "user-1",
    };
    const create = vi.fn().mockResolvedValue(workspace);
    mockCreateWorkspaceService.mockReturnValue({
      getByUser: vi.fn().mockResolvedValue([]),
      create,
    });

    const result = await ensureDefaultWorkspace({} as any, "user-1");

    expect(result).toBe(workspace);
    expect(create).toHaveBeenCalledWith("Personal", "user-1");
  });

  it("uses a custom default name when provided", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "ws-new",
      name: "Acme Analytics",
      created_at: "2026-05-14T00:00:00Z",
      owner_id: "user-1",
    });
    mockCreateWorkspaceService.mockReturnValue({
      getByUser: vi.fn().mockResolvedValue([]),
      create,
    });

    await ensureDefaultWorkspace({} as any, "user-1", "Acme Analytics");

    expect(create).toHaveBeenCalledWith("Acme Analytics", "user-1");
  });
});
