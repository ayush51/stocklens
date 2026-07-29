import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceSettings } from "@/features/workspace/server/queries";

export function MemberList({ members }: { members: WorkspaceSettings["members"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between text-sm">
            <span>{member.email}</span>
            <Badge variant="outline">{member.role}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
