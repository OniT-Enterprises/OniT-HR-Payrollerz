import React, { useState, useEffect } from "react";
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
import { adminService } from "@/services/adminService";
import { UserProfile } from "@/types/user";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function UserList() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleSuperadminAction = async () => {
    if (!confirmDialog.user) return;

    const targetUser = confirmDialog.user;
    const grantSuperadmin = confirmDialog.action === "grant";

    try {
      setActionLoading(targetUser.uid);
      await adminService.setSuperadmin(targetUser.uid, grantSuperadmin);
      toast.success(
        grantSuperadmin
          ? `${targetUser.email} is now a superadmin`
          : `Superadmin removed from ${targetUser.email}`
      );
      loadUsers();
    } catch (error: any) {
      console.error("Error updating superadmin status:", error);
      toast.error(error.message || "Failed to update superadmin status");
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, user: null, action: "grant" });
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: any): string => {
    if (!date) return "-";
    if (date.toDate) {
      return formatDateTL(date.toDate()) || "-";
    }
    if (date.seconds) {
      return formatDateTL(new Date(date.seconds * 1000)) || "-";
    }
    return formatDateTL(new Date(date)) || "-";
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
                  <span>Platform Management</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight">Users</h1>
                <p className="text-muted-foreground">
                  Manage all platform users and superadmin access
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
                  <p className="text-sm text-muted-foreground">Total Users</p>
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
                  <p className="text-sm text-muted-foreground">Superadmins</p>
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
                  <p className="text-sm text-muted-foreground">With Tenants</p>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">All Users</CardTitle>
                <CardDescription>
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
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
                <p className="text-muted-foreground">No users found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                            <p className="font-medium">{user.displayName || "No name"}</p>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.isSuperAdmin ? (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 border">
                            <Shield className="h-3 w-3 mr-1" />
                            Superadmin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
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
                              variant="ghost"
                              size="icon"
                              disabled={actionLoading === user.uid}
                            >
                              {actionLoading === user.uid ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
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
                                Remove Superadmin
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
                                Make Superadmin
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                ? "Grant Superadmin Access"
                : "Revoke Superadmin Access"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "grant" ? (
                <>
                  You are about to grant superadmin access to{" "}
                  <strong>{confirmDialog.user?.email}</strong>. This will give them full
                  access to all tenants and platform management features.
                </>
              ) : (
                <>
                  You are about to revoke superadmin access from{" "}
                  <strong>{confirmDialog.user?.email}</strong>. They will no longer be
                  able to access the admin console or manage other tenants.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, user: null, action: "grant" })}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.action === "revoke" ? "destructive" : "default"}
              onClick={handleSuperadminAction}
              disabled={actionLoading !== null}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : confirmDialog.action === "grant" ? (
                "Grant Superadmin"
              ) : (
                "Revoke Superadmin"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
