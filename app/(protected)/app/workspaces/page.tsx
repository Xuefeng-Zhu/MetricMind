"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { createWorkspaceService, Workspace } from "@/lib/workspaces/workspace-service";
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

const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name must be 100 characters or less"),
});

type CreateWorkspaceFormData = z.infer<typeof createWorkspaceSchema>;

export default function WorkspacesPage() {
  const { workspaces, setWorkspaces, setCurrentWorkspace, isLoading, setIsLoading } =
    useWorkspaceStore();
  const { user, setWorkspaceContext } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceFormData>({
    resolver: zodResolver(createWorkspaceSchema),
  });

  useEffect(() => {
    loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadWorkspaces() {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const service = createWorkspaceService(supabase);
      const userWorkspaces = await service.getByUser(user.id);
      setWorkspaces(userWorkspaces);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
    } finally {
      setIsLoading(false);
    }
  }

  async function onCreateWorkspace(data: CreateWorkspaceFormData) {
    if (!user) return;
    setError(null);

    try {
      const supabase = createClient();
      const service = createWorkspaceService(supabase);
      const workspace = await service.create(data.name, user.id);
      setWorkspaces([...workspaces, workspace]);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    }
  }

  function selectWorkspace(workspace: Workspace) {
    setCurrentWorkspace(workspace);
    setWorkspaceContext({
      workspaceId: workspace.id,
      role: workspace.owner_id === user?.id ? "owner" : "viewer",
    });
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Workspaces</h1>

      {/* Create Workspace Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Create Workspace</CardTitle>
          <CardDescription>
            Create a new workspace to organize your data and collaborate with your team.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onCreateWorkspace)}>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                placeholder="My Workspace"
                {...register("name")}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name && (
                <p id="name-error" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Workspace"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Workspace List */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading workspaces...</p>
      ) : workspaces.length === 0 ? (
        <p className="text-muted-foreground">
          No workspaces yet. Create one above to get started.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.map((workspace) => (
            <Card key={workspace.id}>
              <CardHeader>
                <CardTitle className="text-lg">{workspace.name}</CardTitle>
                <CardDescription>
                  Created {new Date(workspace.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => selectWorkspace(workspace)}
                >
                  Select
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
