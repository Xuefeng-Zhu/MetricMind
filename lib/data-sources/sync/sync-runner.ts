import type { DataSourcesRepository } from "@/lib/data-sources/repository";

export interface SyncRunnerInput {
  repository: DataSourcesRepository;
  workspaceId: string;
  dataSourceId: string;
  profileId: string;
  rowCount: number;
  sourceName: string;
}

export async function runMockSync(input: SyncRunnerInput) {
  const started = Date.now();
  const syncRun = await input.repository.createSyncRun({
    workspaceId: input.workspaceId,
    dataSourceId: input.dataSourceId,
    triggeredBy: "Manual",
    triggeredByUserId: input.profileId,
    message: "Manual metadata refresh started.",
  });

  try {
    await input.repository.updateDataSource(input.dataSourceId, {
      sync_status: "syncing",
      status: "processing",
    });

    const completedAt = new Date().toISOString();
    const completedRun = await input.repository.updateSyncRun(syncRun.id, {
      status: "success",
      completed_at: completedAt,
      duration_ms: Date.now() - started,
      row_count: input.rowCount,
      message: `${input.sourceName} metadata refresh completed.`,
    });

    const dataSource = await input.repository.updateDataSource(input.dataSourceId, {
      sync_status: "synced",
      status: "ready",
      last_synced_at: completedAt,
    });

    return { syncRun: completedRun, dataSource };
  } catch (error) {
    await input.repository.updateSyncRun(syncRun.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      message: error instanceof Error ? error.message : "Sync failed.",
    });
    throw error;
  }
}
