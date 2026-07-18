import React, { useState } from "react";
import { formatDateTL } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KeyRound, Loader2, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import {
  useAddTenantMember,
  useRemoveTenantMember,
  useSendMemberPasswordReset,
  useTenantMembers,
  useUpdateTenantMember,
} from "@/hooks/useAdmin";
import {
  DEFAULT_ROLE_PERMISSIONS,
  ModulePermission,
  TenantMember,
  TenantRole,
} from "@/types/tenant";
import { OptionalTimestamp } from "@/types/firebase";
import { toast } from "sonner";

const ROLE_OPTIONS: { value: TenantRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "hr-admin", label: "HR Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "manager", label: "Manager" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_BADGES: Record<TenantRole, string> = {
  owner: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "hr-admin": "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  accountant: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  manager: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  viewer: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

const MODULE_OPTIONS: { value: ModulePermission; label: string }[] = [
  { value: "staff", label: "Staff" },
  { value: "hiring", label: "Hiring" },
  { value: "timeleave", label: "Time & Leave" },
  { value: "performance", label: "Performance" },
  { value: "payroll", label: "Payroll" },
  { value: "money", label: "Money" },
  { value: "accounting", label: "Accounting" },
  { value: "reports", label: "Reports" },
];

function roleLabel(role: TenantRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

function formatMemberDate(value: OptionalTimestamp): string {
  if (!value) return "-";
  if (typeof value === "object" && "toDate" in value) {
    return formatDateTL(value.toDate()) || "-";
  }
  if (value instanceof Date) {
    return formatDateTL(value) || "-";
  }
  return "-";
}

interface MemberFormState {
  email: string;
  role: TenantRole;
  modules: ModulePermission[];
}

interface TenantMembersCardProps {
  tenantId: string;
  tenantName: string;
}

export function TenantMembersCard({ tenantId, tenantName }: TenantMembersCardProps) {
  const { data: members = [], isLoading } = useTenantMembers(tenantId);
  const addMutation = useAddTenantMember();
  const updateMutation = useUpdateTenantMember();
  const removeMutation = useRemoveTenantMember();
  const resetMutation = useSendMemberPasswordReset();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TenantMember | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TenantMember | null>(null);
  const [resettingUid, setResettingUid] = useState<string | null>(null);
  const [form, setForm] = useState<MemberFormState>({
    email: "",
    role: "hr-admin",
    modules: DEFAULT_ROLE_PERMISSIONS["hr-admin"],
  });

  const openAddDialog = () => {
    setEditingMember(null);
    setForm({ email: "", role: "hr-admin", modules: DEFAULT_ROLE_PERMISSIONS["hr-admin"] });
    setDialogOpen(true);
  };

  const openEditDialog = (member: TenantMember) => {
    setEditingMember(member);
    setForm({
      email: member.email || "",
      role: member.role,
      modules:
        member.modules && member.modules.length > 0
          ? member.modules
          : DEFAULT_ROLE_PERMISSIONS[member.role],
    });
    setDialogOpen(true);
  };

  const handleRoleChange = (role: TenantRole) => {
    setForm((current) => ({ ...current, role, modules: DEFAULT_ROLE_PERMISSIONS[role] }));
  };

  const toggleModule = (module: ModulePermission, checked: boolean) => {
    setForm((current) => ({
      ...current,
      modules: checked
        ? [...current.modules, module]
        : current.modules.filter((item) => item !== module),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (editingMember) {
        await updateMutation.mutateAsync({
          tenantId,
          memberUid: editingMember.uid,
          role: form.role,
          modules: form.modules,
        });
        toast.success(`Access updated for ${editingMember.email || "member"}`);
      } else {
        await addMutation.mutateAsync({
          tenantId,
          tenantName,
          userEmail: form.email.trim(),
          role: form.role,
          modules: form.modules,
        });
        toast.success(`${form.email.trim()} added to ${tenantName}. New users receive a password setup email.`);
      }
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Operation failed";
      toast.error(message);
    }
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;

    try {
      await removeMutation.mutateAsync({ tenantId, memberUid: memberToRemove.uid });
      toast.success(`${memberToRemove.email || "Member"} removed from ${tenantName}`);
      setMemberToRemove(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove member";
      toast.error(message);
    }
  };

  const handleSendReset = async (member: TenantMember) => {
    setResettingUid(member.uid);
    try {
      const message = await resetMutation.mutateAsync({ tenantId, memberUid: member.uid });
      toast.success(message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not send password reset";
      toast.error(errorMessage);
    } finally {
      setResettingUid(null);
    }
  };

  const saving = addMutation.isPending || updateMutation.isPending;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Tenant access</CardTitle>
            <CardDescription>
              Platform users who can sign in to {tenantName}
            </CardDescription>
          </div>
          <Button onClick={openAddDialog} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add user
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No platform users yet.</p>
            <Button variant="link" onClick={openAddDialog}>
              Add the first user
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const effectiveModules =
                  member.modules && member.modules.length > 0
                    ? member.modules
                    : DEFAULT_ROLE_PERMISSIONS[member.role] ?? [];
                return (
                  <TableRow key={member.uid} className="hover:bg-muted/50">
                    <TableCell>
                      <p className="font-medium">{member.email || member.uid}</p>
                      {member.displayName && (
                        <p className="text-sm text-muted-foreground">{member.displayName}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border ${ROLE_BADGES[member.role] ?? ROLE_BADGES.viewer}`}>
                        {roleLabel(member.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {effectiveModules.length === 0 ? (
                          <span className="text-sm text-muted-foreground">None</span>
                        ) : (
                          effectiveModules.map((module) => (
                            <span
                              key={module}
                              className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-primary/10 text-primary"
                            >
                              {MODULE_OPTIONS.find((option) => option.value === module)?.label ?? module}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatMemberDate(member.joinedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSendReset(member)}
                              disabled={resettingUid === member.uid}
                            >
                              {resettingUid === member.uid ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <KeyRound className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send password reset</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(member)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit role & modules</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setMemberToRemove(member)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove from tenant</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit access" : "Add user"}</DialogTitle>
            <DialogDescription>
              {editingMember
                ? `Change the role and modules for ${editingMember.email || "this member"}.`
                : `Give someone access to ${tenantName}. New email addresses get an account and a password setup email.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="user@company.tl"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                disabled={Boolean(editingMember)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(value) => handleRoleChange(value as TenantRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modules</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODULE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={form.modules.includes(option.value)}
                      onCheckedChange={(checked) => toggleModule(option.value, checked === true)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Changing the role resets modules to that role's defaults. Modules disabled for the
                tenant are ignored.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || (!editingMember && !form.email.trim())}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingMember ? "Save changes" : "Add user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {memberToRemove?.email || "this member"}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to {tenantName} immediately. Their employee record (if any) is
              not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleRemove();
              }}
              disabled={removeMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
