"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/insforge/client";
import {
  createWorkspaceService,
  Membership,
  Role,
} from "@/lib/workspaces/workspace-service";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

const inviteMemberSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["admin", "analyst", "viewer"], {
    required_error: "Please select a role",
  }),
});

type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

export default function SettingsPage() {
  const { currentWorkspace, members, setMembers, isLoading, setIsLoading } =
    useWorkspaceStore();
  const { user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { role: "viewer" },
  });

  useEffect(() => {
    if (currentWorkspace) {
      loadMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace]);

  async function loadMembers() {
    if (!currentWorkspace) return;
    setIsLoading(true);
    setError(null);

    try {
      const insforge = createClient();
      const { data, error: fetchError } = await insforge
        .from("workspace_members")
        .select("id, workspace_id, user_id, role, invited_at")
        .eq("workspace_id", currentWorkspace.id);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setMembers((data ?? []) as Membership[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setIsLoading(false);
    }
  }

  async function onInviteMember(data: InviteMemberFormData) {
    if (!currentWorkspace) return;
    setError(null);
    setSuccessMessage(null);

    try {
      const insforge = createClient();
      const service = createWorkspaceService(insforge);
      const membership = await service.inviteMember(
        currentWorkspace.id,
        data.email,
        data.role as Role
      );
      setMembers([...members, membership]);
      setSuccessMessage(`Successfully invited ${data.email} as ${data.role}`);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    }
  }

  async function handleRoleChange(memberId: string, newRole: Role) {
    if (!currentWorkspace) return;
    setError(null);
    setSuccessMessage(null);

    try {
      const insforge = createClient();
      const service = createWorkspaceService(insforge);
      const updated = await service.updateMemberRole(
        currentWorkspace.id,
        memberId,
        newRole
      );
      setMembers(
        members.map((m) => (m.id === memberId ? updated : m))
      );
      setSuccessMessage("Role updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!currentWorkspace) return;
    setError(null);
    setSuccessMessage(null);

    try {
      const insforge = createClient();
      const service = createWorkspaceService(insforge);
      await service.removeMember(currentWorkspace.id, memberId);
      setMembers(members.filter((m) => m.id !== memberId));
      setSuccessMessage("Member removed successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  if (!currentWorkspace) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Workspace Settings</h1>
      <p className="text-muted-foreground mb-8">{currentWorkspace.name}</p>

      {/* Invite Member Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Invite Member</CardTitle>
          <CardDescription>
            Invite a team member by email and assign them a role.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onInviteMember)}>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  {...register("email")}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...register("role")}
                  aria-describedby={errors.role ? "role-error" : undefined}
                >
                  <option value="viewer">Viewer</option>
                  <option value="analyst">Analyst</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.role && (
                  <p id="role-error" className="text-sm text-destructive">
                    {errors.role.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Inviting..." : "Invite Member"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-4 rounded-md bg-green-50 text-green-700 text-sm dark:bg-green-900/20 dark:text-green-400">
          {successMessage}
        </div>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Manage workspace members and their roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground">No members found.</p>
          ) : (
            <div className="space-y-4">
              {members.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const isOwner = member.role === "owner";

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-md border"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {member.user_id}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined{" "}
                        {new Date(member.invited_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <span className="text-sm font-medium text-muted-foreground">
                          Owner
                        </span>
                      ) : (
                        <>
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(
                                member.id,
                                e.target.value as Role
                              )
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                            disabled={isCurrentUser}
                            aria-label={`Change role for member ${member.user_id}`}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="analyst">Analyst</option>
                            <option value="admin">Admin</option>
                          </select>
                          {!isCurrentUser && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
