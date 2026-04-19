import React, { useMemo, useState } from "react";
import { formatDateTL } from "@/lib/dateUtils";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAllUsers,
  useApproveSuperAdminRequest,
  useRequestSuperAdminChange,
  useSuperAdminRequests,
} from "@/hooks/useAdmin";
import { OptionalTimestamp } from "@/types/firebase";
import { Loader2, Mail, Plus, Shield, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { toast } from "sonner";

function formatDateValue(value: OptionalTimestamp): string {
  if (!value) return "-";
  if (typeof value === "object" && "toDate" in value) {
    return formatDateTL(value.toDate()) || "-";
  }
  if (value instanceof Date) {
    return formatDateTL(value) || "-";
  }
  return "-";
}

export default function UserList() {
  const { user, userProfile } = useAuth();
  const { data: users = [], isLoading: loadingUsers } = useAllUsers();
  const { data: requests = [], isLoading: loadingRequests } = useSuperAdminRequests();
  const requestMutation = useRequestSuperAdminChange();
  const approveMutation = useApproveSuperAdminRequest();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailValue, setEmailValue] = useState("");

  const superAdmins = useMemo(() => users.filter((candidate) => candidate.isSuperAdmin), [users]);
  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status !== "approved" && request.status !== "rejected"),
    [requests],
  );

  const handleRequestAdd = async () => {
    if (!user || !emailValue.trim()) return;

    try {
      await requestMutation.mutateAsync({
        type: "grant",
        targetEmail: emailValue.trim(),
        requestedByUid: user.uid,
        requestedByEmail: user.email || userProfile?.email || "",
        requestedByName: userProfile?.displayName || user.email || "",
      });
      toast.success("Super admin request created. Waiting for another super admin to confirm.");
      setDialogOpen(false);
      setEmailValue("");
    } catch (error) {
      console.error(error);
      toast.error("Could not create that request.");
    }
  };

  const handleRequestRemove = async (targetUid: string, targetEmail: string, targetDisplayName?: string) => {
    if (!user) return;

    try {
      await requestMutation.mutateAsync({
        type: "revoke",
        targetUid,
        targetEmail,
        targetDisplayName,
        requestedByUid: user.uid,
        requestedByEmail: user.email || userProfile?.email || "",
        requestedByName: userProfile?.displayName || user.email || "",
      });
      toast.success("Removal request created. Waiting for another super admin to confirm.");
    } catch (error) {
      console.error(error);
      toast.error("Could not create the removal request.");
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!user) return;

    try {
      const result = await approveMutation.mutateAsync({
        requestId,
        approverUid: user.uid,
        approverEmail: user.email || userProfile?.email || "",
      });

      if (result.status === "awaiting_user") {
        toast.success("Confirmed. The target email now needs to sign in before activation can finish.");
      } else {
        toast.success("Request confirmed.");
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not confirm the request.");
    }
  };

  return (
    <AdminLayout>
      <div className="px-6 py-8 lg:px-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-amber-500">Platform access</p>
            <h1 className="text-4xl font-bold tracking-tight">Super Admins</h1>
            <p className="text-muted-foreground mt-2">
              Add or remove super admins through a two-step approval flow. The status stays visible until it is confirmed.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Super Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Super Admin</DialogTitle>
                <DialogDescription>
                  We will create a request and notify the other super admins. The request will stay in awaiting confirmation until one of them approves it.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label htmlFor="super-admin-email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="super-admin-email"
                  type="email"
                  value={emailValue}
                  onChange={(event) => setEmailValue(event.target.value)}
                  placeholder="admin@company.com"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRequestAdd} disabled={requestMutation.isPending || !emailValue.trim()}>
                  {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Super Admins</p>
                  <p className="text-2xl font-bold">{superAdmins.length}</p>
                </div>
                <Shield className="h-5 w-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Awaiting Confirmation</p>
                  <p className="text-2xl font-bold">{pendingRequests.filter((request) => request.status === "awaiting_confirmation").length}</p>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Awaiting User Sign-In</p>
                  <p className="text-2xl font-bold">{pendingRequests.filter((request) => request.status === "awaiting_user").length}</p>
                </div>
                <Users className="h-5 w-5 text-cyan-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Current Super Admins</CardTitle>
            <CardDescription>
              Removing a super admin now creates a confirmation request that another super admin must approve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-xl border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Super Admin</TableHead>
                      <TableHead>Tenants</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {superAdmins.map((superAdmin) => (
                      <TableRow key={superAdmin.uid}>
                        <TableCell>
                          <div className="font-medium">{superAdmin.displayName || superAdmin.email}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {superAdmin.email}
                          </div>
                        </TableCell>
                        <TableCell>{superAdmin.tenantIds?.length || 0}</TableCell>
                        <TableCell>{formatDateValue(superAdmin.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={superAdmin.uid === user?.uid || requestMutation.isPending}
                            onClick={() =>
                              handleRequestRemove(
                                superAdmin.uid,
                                superAdmin.email,
                                superAdmin.displayName || superAdmin.email,
                              )
                            }
                          >
                            <ShieldOff className="h-4 w-4" />
                            Request Removal
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
            <CardDescription>
              Another super admin must confirm each request. The requester cannot approve their own request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests right now.</p>
            ) : (
              <div className="rounded-xl border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Request</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="font-medium">{request.targetDisplayName || request.targetEmail}</div>
                          <div className="text-sm text-muted-foreground">{request.targetEmail}</div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {request.type === "grant" ? "Grant super admin" : "Remove super admin"}
                          </p>
                          <p className="text-sm text-muted-foreground">{formatDateValue(request.requestedAt)}</p>
                        </TableCell>
                        <TableCell>{request.requestedByEmail}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {request.status === "awaiting_confirmation" ? "Awaiting confirmation" : "Awaiting user"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="gap-2"
                            disabled={
                              approveMutation.isPending ||
                              request.requestedByUid === user?.uid
                            }
                            onClick={() => handleApprove(request.id)}
                          >
                            {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            {request.status === "awaiting_user" ? "Activate" : "Confirm"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
