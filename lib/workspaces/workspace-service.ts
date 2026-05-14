import { InsForgeDatabaseClient } from "@/lib/insforge/types";

export type Role = "owner" | "admin" | "analyst" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
}

export interface Membership {
  id: string;
  workspace_id: string;
  user_id: string;
  role: Role;
  invited_at: string;
}

export interface WorkspaceService {
  create(name: string, userId: string): Promise<Workspace>;
  getByUser(userId: string): Promise<Workspace[]>;
  inviteMember(
    workspaceId: string,
    email: string,
    role: Role
  ): Promise<Membership>;
  updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: Role
  ): Promise<Membership>;
  removeMember(workspaceId: string, memberId: string): Promise<void>;
  transferOwnership(
    workspaceId: string,
    newOwnerId: string
  ): Promise<void>;
}

export function createWorkspaceService(
  insforge: InsForgeDatabaseClient
): WorkspaceService {
  return {
    async create(name: string, userId: string): Promise<Workspace> {
      // Create the workspace with the user as owner
      const { data: workspace, error: workspaceError } = await insforge
        .from("workspaces")
        .insert({ name, owner_id: userId })
        .select("id, name, created_at, owner_id")
        .single();

      if (workspaceError || !workspace) {
        throw new Error(
          workspaceError?.message ?? "Failed to create workspace"
        );
      }

      // Add the creating user as a member with 'owner' role
      const { error: memberError } = await insforge
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          role: "owner",
        });

      if (memberError) {
        throw new Error(memberError.message);
      }

      return workspace as Workspace;
    },

    async getByUser(userId: string): Promise<Workspace[]> {
      // Get all workspaces where the user is a member
      const { data: memberships, error: memberError } = await insforge
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId);

      if (memberError) {
        throw new Error(memberError.message);
      }

      if (!memberships || memberships.length === 0) {
        return [];
      }

      const workspaceIds = memberships.map((m) => m.workspace_id);

      const { data: workspaces, error: workspaceError } = await insforge
        .from("workspaces")
        .select("id, name, created_at, owner_id")
        .in("id", workspaceIds);

      if (workspaceError) {
        throw new Error(workspaceError.message);
      }

      return (workspaces ?? []) as Workspace[];
    },

    async inviteMember(
      workspaceId: string,
      email: string,
      role: Role
    ): Promise<Membership> {
      // Look up the auth user id by email using an RPC function
      const { data: authUserId, error: authError } = await insforge.rpc(
        "get_user_id_by_email",
        { email_input: email }
      );

      if (authError || !authUserId) {
        throw new Error(`User with email "${email}" not found`);
      }

      // Get the profile id for this auth user
      const { data: profile, error: profileError } = await insforge
        .from("profiles")
        .select("id")
        .eq("auth_user_id", authUserId)
        .single();

      if (profileError || !profile) {
        throw new Error(`Profile for email "${email}" not found`);
      }

      // Create the membership record
      const { data: membership, error: memberError } = await insforge
        .from("workspace_members")
        .insert({
          workspace_id: workspaceId,
          user_id: profile.id,
          role,
        })
        .select("id, workspace_id, user_id, role, invited_at")
        .single();

      if (memberError || !membership) {
        throw new Error(
          memberError?.message ?? "Failed to create membership"
        );
      }

      return membership as Membership;
    },

    async updateMemberRole(
      workspaceId: string,
      memberId: string,
      role: Role
    ): Promise<Membership> {
      const { data: membership, error } = await insforge
        .from("workspace_members")
        .update({ role })
        .eq("id", memberId)
        .eq("workspace_id", workspaceId)
        .select("id, workspace_id, user_id, role, invited_at")
        .single();

      if (error || !membership) {
        throw new Error(error?.message ?? "Failed to update member role");
      }

      return membership as Membership;
    },

    async removeMember(
      workspaceId: string,
      memberId: string
    ): Promise<void> {
      const { error } = await insforge
        .from("workspace_members")
        .delete()
        .eq("id", memberId)
        .eq("workspace_id", workspaceId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async transferOwnership(
      workspaceId: string,
      newOwnerId: string
    ): Promise<void> {
      // Get the current owner from the workspace
      const { data: workspace, error: wsError } = await insforge
        .from("workspaces")
        .select("owner_id")
        .eq("id", workspaceId)
        .single();

      if (wsError || !workspace) {
        throw new Error(wsError?.message ?? "Workspace not found");
      }

      const currentOwnerId = workspace.owner_id;

      // Atomically update: demote current owner to admin, promote new owner, update workspace
      // Update current owner's role to admin
      const { error: demoteError } = await insforge
        .from("workspace_members")
        .update({ role: "admin" })
        .eq("workspace_id", workspaceId)
        .eq("user_id", currentOwnerId);

      if (demoteError) {
        throw new Error(
          `Failed to demote current owner: ${demoteError.message}`
        );
      }

      // Update new owner's role to owner
      const { error: promoteError } = await insforge
        .from("workspace_members")
        .update({ role: "owner" })
        .eq("workspace_id", workspaceId)
        .eq("user_id", newOwnerId);

      if (promoteError) {
        // Attempt to rollback the demotion
        await insforge
          .from("workspace_members")
          .update({ role: "owner" })
          .eq("workspace_id", workspaceId)
          .eq("user_id", currentOwnerId);

        throw new Error(
          `Failed to promote new owner: ${promoteError.message}`
        );
      }

      // Update workspace owner_id
      const { error: updateError } = await insforge
        .from("workspaces")
        .update({ owner_id: newOwnerId })
        .eq("id", workspaceId);

      if (updateError) {
        // Attempt to rollback both role changes
        await insforge
          .from("workspace_members")
          .update({ role: "owner" })
          .eq("workspace_id", workspaceId)
          .eq("user_id", currentOwnerId);

        await insforge
          .from("workspace_members")
          .update({ role: "viewer" })
          .eq("workspace_id", workspaceId)
          .eq("user_id", newOwnerId);

        throw new Error(
          `Failed to update workspace owner: ${updateError.message}`
        );
      }
    },
  };
}
