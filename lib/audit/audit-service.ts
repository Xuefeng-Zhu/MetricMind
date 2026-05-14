import { InsForgeDatabaseClient } from "@/lib/insforge/types";

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "member.invited"
  | "member.removed"
  | "member.role_changed"
  | "datasource.created"
  | "metric.created"
  | "metric.certified"
  | "metric.modified"
  | "query.executed"
  | "query.rejected"
  | "alert.fired"
  | "security.violation";

export interface AuditEvent {
  id: string;
  workspace_id: string;
  actor_id: string;
  action: AuditAction;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface AuditFilters {
  action?: AuditAction;
  actorId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditService {
  log(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void>;
  getEvents(workspaceId: string, filters?: AuditFilters): Promise<AuditEvent[]>;
}

export function createAuditService(insforge: InsForgeDatabaseClient): AuditService {
  return {
    async log(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void> {
      const { error } = await insforge.from("audit_events").insert({
        workspace_id: event.workspace_id,
        actor_id: event.actor_id,
        action: event.action,
        target_type: event.target_type,
        target_id: event.target_id,
        metadata: event.metadata,
      });

      if (error) {
        throw new Error(`Failed to log audit event: ${error.message}`);
      }
    },

    async getEvents(
      workspaceId: string,
      filters?: AuditFilters
    ): Promise<AuditEvent[]> {
      let query = insforge
        .from("audit_events")
        .select("id, workspace_id, actor_id, action, target_type, target_id, metadata, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (filters?.action) {
        query = query.eq("action", filters.action);
      }

      if (filters?.actorId) {
        query = query.eq("actor_id", filters.actorId);
      }

      const limit = filters?.limit ?? 100;
      const offset = filters?.offset ?? 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch audit events: ${error.message}`);
      }

      return (data ?? []).map((row: any) => ({
        id: row.id,
        workspace_id: row.workspace_id,
        actor_id: row.actor_id,
        action: row.action as AuditAction,
        target_type: row.target_type,
        target_id: row.target_id,
        metadata: row.metadata ?? {},
        timestamp: row.created_at,
      }));
    },
  };
}
