import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { SEO } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  useAddTenantMember,
  useRemoveTenantMember,
  useSendMemberPasswordReset,
  useTenantMembers,
  useUpdateTenantMember,
} from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  DEFAULT_ROLE_PERMISSIONS,
  type ModulePermission,
  type TenantMember,
  type TenantRole,
} from "@/types/tenant";
import {
  ArrowLeft,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

const MODULES: ModulePermission[] = [
  "hiring",
  "staff",
  "timeleave",
  "performance",
  "payroll",
  "money",
  "accounting",
  "reports",
];

const ROLES: TenantRole[] = ["owner", "hr-admin", "accountant", "manager", "viewer"];

export default function TeamAccessSettings() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const { session } = useTenant();
  const tenantId = session?.tid;
  const membersQuery = useTenantMembers(tenantId);
  const addMember = useAddTenantMember();
  const updateMember = useUpdateTenantMember();
  const removeMember = useRemoveTenantMember();
  const resetPassword = useSendMemberPasswordReset();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TenantRole>("viewer");
  const [editing, setEditing] = useState<TenantMember | null>(null);
  const [editRole, setEditRole] = useState<TenantRole>("viewer");
  const [editModules, setEditModules] = useState<ModulePermission[]>([]);
  const [removing, setRemoving] = useState<TenantMember | null>(null);

  const availableRoles = useMemo(
    () => session?.role === "owner" ? ROLES : ROLES.filter((role) => role !== "owner"),
    [session?.role],
  );

  const roleLabel = (role: TenantRole) => t(`settings.access.roles.${role}`);
  const moduleLabel = (module: ModulePermission) => t(`settings.access.modules.${module}`);

  const showError = (error: unknown) => {
    toast({
      title: t("common.error"),
      description: error instanceof Error ? error.message : t("settings.access.actionFailed"),
      variant: "destructive",
    });
  };

  const handleInvite = async () => {
    if (!tenantId || !session || !inviteEmail.trim()) return;
    try {
      await addMember.mutateAsync({
        tenantId,
        tenantName: session.config.name || tenantId,
        userEmail: inviteEmail.trim(),
        role: inviteRole,
      });
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("viewer");
      toast({
        title: t("settings.access.invitedTitle"),
        description: t("settings.access.invitedDescription"),
      });
    } catch (error) {
      showError(error);
    }
  };

  const openEdit = (member: TenantMember) => {
    setEditing(member);
    setEditRole(member.role);
    setEditModules([...(member.modules || DEFAULT_ROLE_PERMISSIONS[member.role])]);
  };

  const handleUpdate = async () => {
    if (!tenantId || !editing) return;
    try {
      await updateMember.mutateAsync({
        tenantId,
        memberUid: editing.uid,
        role: editRole,
        modules: editModules,
      });
      setEditing(null);
      toast({ title: t("settings.access.updatedTitle") });
    } catch (error) {
      showError(error);
    }
  };

  const handleReset = async (member: TenantMember) => {
    if (!tenantId) return;
    try {
      await resetPassword.mutateAsync({ tenantId, memberUid: member.uid });
      toast({
        title: t("settings.access.resetSentTitle"),
        description: member.email || "",
      });
    } catch (error) {
      showError(error);
    }
  };

  const handleRemove = async () => {
    if (!tenantId || !removing) return;
    try {
      await removeMember.mutateAsync({ tenantId, memberUid: removing.uid });
      setRemoving(null);
      toast({ title: t("settings.access.removedTitle") });
    } catch (error) {
      showError(error);
    }
  };

  const canEditMember = (member: TenantMember) =>
    member.uid !== user?.uid
    && !member.partnerId
    && (session?.role === "owner" || member.role !== "owner");

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Team Access | Xefe" description="Manage company access" noIndex />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:p-6">
        <Link
          to="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.allSettings")}
        </Link>
        <PageHeader
          title={t("settings.access.title")}
          subtitle={t("settings.access.description")}
          icon={Users}
          iconColor="text-primary"
          actions={(
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.access.invite")}
            </Button>
          )}
        />

        <Card>
          <CardContent className="p-0">
            {membersQuery.isLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
              </div>
            ) : membersQuery.isError ? (
              <div className="p-6 text-sm text-destructive">
                {t("settings.access.loadFailed")}
              </div>
            ) : (membersQuery.data || []).length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                {t("settings.access.empty")}
              </div>
            ) : (
              <div className="divide-y">
                {(membersQuery.data || []).map((member) => (
                  <div
                    key={member.uid}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">
                          {member.displayName || member.email || t("settings.access.unnamed")}
                        </p>
                        <Badge variant="secondary">{roleLabel(member.role)}</Badge>
                        {member.uid === user?.uid && (
                          <Badge variant="outline">{t("settings.access.you")}</Badge>
                        )}
                      </div>
                      {member.displayName && member.email && (
                        <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(member.modules || DEFAULT_ROLE_PERMISSIONS[member.role])
                          .map(moduleLabel)
                          .join(" · ") || t("settings.access.noModules")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canEditMember(member) && (
                        <Button variant="outline" size="sm" onClick={() => openEdit(member)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t("common.edit")}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleReset(member)}
                        disabled={resetPassword.isPending}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        {t("settings.access.resetPassword")}
                      </Button>
                      {canEditMember(member) && (
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(member)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("common.remove")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.access.inviteTitle")}</DialogTitle>
            <DialogDescription>{t("settings.access.inviteDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">{t("settings.access.email")}</Label>
              <Input
                id="member-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.access.role")}</Label>
              <Select value={inviteRole} onValueChange={(value: TenantRole) => setInviteRole(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("settings.access.standardAccessHint")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => void handleInvite()}
              disabled={addMember.isPending || !inviteEmail.trim()}
            >
              {addMember.isPending ? t("common.saving") : t("settings.access.sendInvite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("settings.access.editTitle")}</DialogTitle>
            <DialogDescription>{editing?.email || ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("settings.access.role")}</Label>
              <Select
                value={editRole}
                onValueChange={(value: TenantRole) => {
                  setEditRole(value);
                  setEditModules([...DEFAULT_ROLE_PERMISSIONS[value]]);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <Label>{t("settings.access.accessAreas")}</Label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODULES.map((module) => (
                  <div key={module} className="flex items-center gap-2 rounded-md border p-2.5">
                    <Checkbox
                      id={`module-${module}`}
                      checked={editModules.includes(module)}
                      onCheckedChange={(checked) => setEditModules((current) =>
                        checked === true
                          ? Array.from(new Set([...current, module]))
                          : current.filter((item) => item !== module))}
                    />
                    <Label htmlFor={`module-${module}`} className="font-normal">
                      {moduleLabel(module)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => void handleUpdate()} disabled={updateMember.isPending}>
              {updateMember.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.access.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.access.removeDescription", {
                email: removing?.email || removing?.displayName || "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRemove()} disabled={removeMember.isPending}>
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
