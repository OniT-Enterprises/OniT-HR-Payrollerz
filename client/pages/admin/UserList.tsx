import React, { useState } from "react";
import { formatDateTL } from "@/lib/dateUtils";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Loader2,
  Sparkles,
  Mail,
  Calendar,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { useAllUsers, useSetSuperadmin } from "@/hooks/useAdmin";
import { UserProfile } from "@/types/user";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

export default function UserList() {
  const { user: currentUser } = useAuth();
  const { t } = useI18n();
  const { data: users = [], isLoading: loading } = useAllUsers();
  const setSuperadminMutation = useSetSuperadmin();
  const [searchQuery, setSearchQuery] = useState("");

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: UserProfile | null;
    action: "grant" | "revoke";
  }>({
    open: false,
    user: null,
    action: "grant",
  });

  const handleSuperadminAction = async () => {
    if (!confirmDialog.user) return;

    const targetUser = confirmDialog.user;
    const grantSuperadmin = confirmDialog.action === "grant";

    try {
      await setSuperadminMutation.mutateAsync({
        targetUid: targetUser.uid,
        isSuperAdmin: grantSuperadmin,
      });
      toast.success(
        grantSuperadmin
          ? t("admin.userList.toastGrantSuccess", { email: targetUser.email || t("common.unknown") })
          : t("admin.userList.toastRevokeSuccess", { email: targetUser.email || t("common.unknown") })
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("admin.userList.toastUpdateFailed");
      toast.error(message);
    } finally {
      setConfirmDialog({ open: false, user: null, action: "grant" });
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  type FirestoreTimestampLike = { toDate: () => Date } | { seconds: number } | Date | string | null | undefined;

  const formatDate = (date: FirestoreTimestampLike): string => {
    if (!date) return "-";
    if (typeof date === "object" && "toDate" in date) {
      return formatDateTL(date.toDate()) || "-";
    }
    if (typeof date === "object" && "seconds" in date) {
      return formatDateTL(new Date(date.seconds * 1000)) || "-";
    }
    return formatDateTL(new Date(date as Date | string)) || "-";
  };

  const superadminCount = users.filter((u) => u.isSuperAdmin).length;
  const activeCount = users.filter((u) => u.tenantIds && u.tenantIds.length > 0).length;

  return (
    <AdminLayout>
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative px-6 py-8 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-start gap-4 animate-fade-up">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span>{t("admin.platformManagement")}</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight">{t("admin.userList.title")}</h1>
                <p className="text-muted-foreground">
                  {t("admin.userList.subtitle")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.userList.stats.totalUsers")}</p>
                  <p className="text-2xl font-bold">{users.length}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.userList.stats.superadmins")}</p>
                  <p className="text-2xl font-bold text-amber-600">{superadminCount}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Shield className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.userList.stats.withTenants")}</p>
                  <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Building2 className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">{t("admin.userList.allUsers")}</CardTitle>
                <CardDescription>
                  {t("admin.userList.usersFound", { count: String(filteredUsers.length) })}
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("admin.userList.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">{t("admin.userList.noUsers")}</p>
                {searchQuery && (
                  <Button variant="outline" onClick={() => setSearchQuery("")}>
                    {t("admin.userList.clearSearch")}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredUsers.map((user) => (
                    <Card key={user.uid} className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-500 font-semibold text-white">
                              {user.displayName?.[0]?.toUpperCase() ||
                                user.email?.[0]?.toUpperCase() ||
                                "U"}
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">{user.displayName || t("admin.userList.noName")}</p>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </div>
                            </div>
                          </div>
                          {user.isSuperAdmin ? (
                            <Badge className="border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <Shield className="mr-1 h-3 w-3" />
                              {t("admin.userList.roleSuperadmin")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{t("admin.userList.roleUser")}</Badge>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span>{t("admin.userList.tenantsCount", { count: String(user.tenantIds?.length || 0) })}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(user.createdAt)}</span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between"
                                disabled={setSuperadminMutation.isPending && setSuperadminMutation.variables?.targetUid === user.uid}
                              >
                                {setSuperadminMutation.isPending && setSuperadminMutation.variables?.targetUid === user.uid ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t("admin.userList.processing")}
                                  </>
                                ) : (
                                  <>
                                    {t("common.moreActions")}
                                    <MoreHorizontal className="h-4 w-4" />
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[220px]">
                              {user.isSuperAdmin ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      user,
                                      action: "revoke",
                                    })
                                  }
                                  className="text-red-600"
                                  disabled={user.uid === currentUser?.uid}
                                >
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  {t("admin.userList.revokeAction")}
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      user,
                                      action: "grant",
                                    })
                                  }
                                  className="text-amber-600"
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  {t("admin.userList.grantAction")}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.userList.table.user")}</TableHead>
                      <TableHead>{t("admin.userList.table.role")}</TableHead>
                      <TableHead>{t("admin.userList.table.tenants")}</TableHead>
                      <TableHead>{t("admin.userList.table.created")}</TableHead>
                      <TableHead className="text-right">{t("admin.userList.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.uid} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-white font-semibold">
                              {user.displayName?.[0]?.toUpperCase() ||
                                user.email?.[0]?.toUpperCase() ||
                                "U"}
                            </div>
                            <div>
                              <p className="font-medium">{user.displayName || t("admin.userList.noName")}</p>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.isSuperAdmin ? (
                            <Badge className="border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <Shield className="mr-1 h-3 w-3" />
                              {t("admin.userList.roleSuperadmin")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{t("admin.userList.roleUser")}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{user.tenantIds?.length || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(user.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={setSuperadminMutation.isPending && setSuperadminMutation.variables?.targetUid === user.uid}
                              >
                                {setSuperadminMutation.isPending && setSuperadminMutation.variables?.targetUid === user.uid ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t("admin.userList.processing")}
                                  </>
                                ) : (
                                  <>
                                    {t("common.moreActions")}
                                    <MoreHorizontal className="h-4 w-4" />
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {user.isSuperAdmin ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      user,
                                      action: "revoke",
                                    })
                                  }
                                  className="text-red-600"
                                  disabled={user.uid === currentUser?.uid}
                                >
                                  <ShieldOff className="h-4 w-4 mr-2" />
                                  {t("admin.userList.revokeAction")}
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      user,
                                      action: "grant",
                                    })
                                  }
                                  className="text-amber-600"
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  {t("admin.userList.grantAction")}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog({ open: false, user: null, action: "grant" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmDialog.action === "grant"
                ? t("admin.userList.dialog.grantTitle")
                : t("admin.userList.dialog.revokeTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "grant" ? (
                t("admin.userList.dialog.grantDescription", {
                  email: confirmDialog.user?.email || t("common.unknown"),
                })
              ) : (
                t("admin.userList.dialog.revokeDescription", {
                  email: confirmDialog.user?.email || t("common.unknown"),
                })
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, user: null, action: "grant" })}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant={confirmDialog.action === "revoke" ? "destructive" : "default"}
              onClick={handleSuperadminAction}
              disabled={setSuperadminMutation.isPending}
            >
              {setSuperadminMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("admin.userList.processing")}
                </>
              ) : confirmDialog.action === "grant" ? (
                t("admin.userList.grantAction")
              ) : (
                t("admin.userList.revokeAction")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
