import { SupabaseClient } from "@supabase/supabase-js";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useConversationStore } from "@/stores/conversation-store";

/**
 * UUID v4 regex pattern for workspace ID validation.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a workspace ID is a properly formatted UUID.
 * Returns true if valid, false otherwise.
 */
export function validateWorkspaceId(workspaceId: string): boolean {
  if (!workspaceId || typeof workspaceId !== "string") {
    return false;
  }
  return UUID_REGEX.test(workspaceId);
}

/**
 * Switches the active workspace context.
 * - Updates the auth store's workspaceContext with the new workspace ID and role
 * - Clears all workspace-scoped stores (dashboard, conversation, workspace members)
 * - Triggers a reload of workspace-scoped data
 *
 * @param workspaceId - The UUID of the workspace to switch to
 * @param role - The user's role in the target workspace
 * @throws Error if workspaceId is not a valid UUID
 */
export function switchWorkspace(workspaceId: string, role: string): void {
  if (!validateWorkspaceId(workspaceId)) {
    throw new Error(
      `Invalid workspace ID: "${workspaceId}" is not a valid UUID`
    );
  }

  // Update auth store with new workspace context
  const authStore = useAuthStore.getState();
  authStore.setWorkspaceContext({ workspaceId, role });

  // Clear workspace-scoped stores to prevent stale data from previous workspace
  clearWorkspaceScopedStores();

  // Trigger reload of workspace-scoped data
  reloadWorkspaceData(workspaceId);
}

/**
 * Clears all workspace-scoped stores to prevent data leakage between workspaces.
 * This is called during workspace switching to ensure no stale data remains.
 */
function clearWorkspaceScopedStores(): void {
  // Clear dashboard store
  const dashboardStore = useDashboardStore.getState();
  dashboardStore.setDashboards([]);
  dashboardStore.setCurrentDashboard(null);

  // Clear conversation store
  const conversationStore = useConversationStore.getState();
  conversationStore.setConversations([]);
  conversationStore.setCurrentConversation(null);
  conversationStore.setMessages([]);

  // Clear workspace members
  const workspaceStore = useWorkspaceStore.getState();
  workspaceStore.setMembers([]);
}

/**
 * Triggers a reload of workspace-scoped data for the new workspace.
 * Fetches conversations and sets loading state on workspace store.
 */
function reloadWorkspaceData(workspaceId: string): void {
  const workspaceStore = useWorkspaceStore.getState();
  workspaceStore.setIsLoading(true);

  // Trigger async data reload for conversations
  const conversationStore = useConversationStore.getState();
  conversationStore.fetchConversations(workspaceId).finally(() => {
    workspaceStore.setIsLoading(false);
  });
}

/**
 * Logs a critical security violation when cross-workspace data access is detected.
 * This indicates a potential data isolation breach and should be treated as a
 * critical security incident.
 *
 * Logs to both:
 * 1. The audit_events table with action 'security.violation' for persistent record
 * 2. console.error for immediate visibility in monitoring/logging systems
 *
 * @param supabase - Supabase client for database access
 * @param userId - The user ID who triggered the violation
 * @param requestedWorkspaceId - The workspace ID that was requested/expected
 * @param actualWorkspaceId - The workspace ID that was actually returned in the data
 */
export async function logCrossWorkspaceViolation(
  supabase: SupabaseClient,
  userId: string,
  requestedWorkspaceId: string,
  actualWorkspaceId: string
): Promise<void> {
  const metadata = {
    requested_workspace_id: requestedWorkspaceId,
    actual_workspace_id: actualWorkspaceId,
    severity: "critical",
    description:
      "Cross-workspace data access detected. Data from a different workspace was returned.",
    timestamp: new Date().toISOString(),
  };

  // Log to console.error for immediate visibility
  console.error(
    `[SECURITY VIOLATION] Cross-workspace data access detected. ` +
      `User: ${userId}, Requested workspace: ${requestedWorkspaceId}, ` +
      `Actual workspace: ${actualWorkspaceId}`
  );

  // Log to audit_events table
  try {
    const { error } = await supabase.from("audit_events").insert({
      workspace_id: requestedWorkspaceId,
      actor_id: userId,
      action: "security.violation",
      target_type: "workspace",
      target_id: actualWorkspaceId,
      metadata,
    });

    if (error) {
      // If we can't log the security violation to the database, at least ensure
      // it's captured in application logs
      console.error(
        `[SECURITY VIOLATION] Failed to persist audit event: ${error.message}`,
        metadata
      );
    }
  } catch (err) {
    // Ensure the violation is always logged even if the database call throws
    console.error(
      `[SECURITY VIOLATION] Exception while logging audit event:`,
      err,
      metadata
    );
  }
}

/**
 * Ensures a workspace_id is included in a mutation payload.
 * Returns the payload with workspace_id set as a non-nullable field.
 * Throws if the workspace_id is not a valid UUID.
 *
 * @param payload - The data mutation payload
 * @param workspaceId - The workspace ID to include
 * @returns The payload with workspace_id included
 */
export function ensureWorkspaceId<T extends Record<string, unknown>>(
  payload: T,
  workspaceId: string
): T & { workspace_id: string } {
  if (!validateWorkspaceId(workspaceId)) {
    throw new Error(
      `Cannot include invalid workspace_id in mutation: "${workspaceId}"`
    );
  }

  return {
    ...payload,
    workspace_id: workspaceId,
  };
}
