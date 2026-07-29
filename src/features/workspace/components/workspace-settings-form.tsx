"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { renameWorkspace } from "@/features/workspace/server/actions";

export function WorkspaceSettingsForm({
  workspaceId,
  initialName,
}: {
  workspaceId: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await renameWorkspace({ workspaceId, name });
      toast.success("Workspace renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename workspace.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label htmlFor="workspace-name">Name</Label>
          <Input id="workspace-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button onClick={handleSave} disabled={saving || name.trim() === initialName.trim() || !name.trim()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
