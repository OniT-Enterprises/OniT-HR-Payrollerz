/**
 * GrievanceInbox - Anonymous employee grievance management for HR admins
 * Employee identities are never recorded or displayed
 */

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { useTenantId } from "@/contexts/TenantContext";
import { SEO } from "@/components/SEO";
import { formatDateTL } from "@/lib/dateUtils";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import {
  ShieldAlert,
  Eye,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";

type GrievanceCategory = "harassment" | "wage_issue" | "safety_concern" | "discrimination" | "other";
type GrievanceStatus = "submitted" | "reviewing" | "resolved" | "dismissed";

interface Grievance {
  id: string;
  ticketId: string;
  category: GrievanceCategory;
  description: string;
  status: GrievanceStatus;
  createdAt: Date;
  resolution?: string;
  resolvedAt?: Date;
}

const CATEGORY_CONFIG: Record<GrievanceCategory, { label: string; color: string }> = {
  harassment: { label: "Harassment", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  wage_issue: { label: "Wage Issue", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  safety_concern: { label: "Safety Concern", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  discrimination: { label: "Discrimination", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  other: { label: "Other", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:bg-gray-800 dark:text-gray-200" },
};

const STATUS_CONFIG: Record<GrievanceStatus, { label: string; color: string }> = {
  submitted: { label: "New", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  reviewing: { label: "In Review", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  dismissed: { label: "Dismissed", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:bg-gray-800 dark:text-gray-200" },
};

export default function GrievanceInbox() {
  const { toast } = useToast();
  const tenantId = useTenantId();

  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Resolve dialog
  const [resolvingGrievance, setResolvingGrievance] = useState<Grievance | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  // Dismiss dialog
  const [dismissingGrievance, setDismissingGrievance] = useState<Grievance | null>(null);

  const fetchGrievances = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const ref = collection(db, `tenants/${tenantId}/grievances`);
      const q = query(ref, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items: Grievance[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ticketId: data.ticketId || docSnap.id.substring(0, 8).toUpperCase(),
          category: data.category || "other",
          description: data.description || "",
          status: data.status || "submitted",
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : data.createdAt || new Date(),
          resolution: data.resolution || undefined,
          resolvedAt:
            data.resolvedAt instanceof Timestamp
              ? data.resolvedAt.toDate()
              : data.resolvedAt || undefined,
        };
      });
      setGrievances(items);
    } catch (error) {
      console.error("Error fetching grievances:", error);
      toast({
        title: "Error",
        description: "Failed to load grievances",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    if (tenantId) {
      fetchGrievances();
    }
  }, [tenantId, fetchGrievances]);

  const handleStartReview = async (grievance: Grievance) => {
    if (!tenantId) return;

    try {
      const docRef = doc(db, `tenants/${tenantId}/grievances`, grievance.id);
      await updateDoc(docRef, {
        status: "reviewing",
        updatedAt: serverTimestamp(),
      });
      toast({
        title: "Success",
        description: `Grievance ${grievance.ticketId} marked as reviewing`,
      });
      await fetchGrievances();
    } catch (error) {
      console.error("Error updating grievance:", error);
      toast({
        title: "Error",
        description: "Failed to update grievance status",
        variant: "destructive",
      });
    }
  };

  const handleResolve = async () => {
    if (!tenantId || !resolvingGrievance || saving) return;

    if (!resolutionText.trim()) {
      toast({
        title: "Error",
        description: "Resolution notes are required",
        variant: "destructive",
      });
      return;
    }

    if (resolutionText.trim().length < 10) {
      toast({
        title: "Error",
        description: "Resolution notes must be at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, `tenants/${tenantId}/grievances`, resolvingGrievance.id);
      await updateDoc(docRef, {
        status: "resolved",
        resolution: resolutionText.trim(),
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({
        title: "Success",
        description: `Grievance ${resolvingGrievance.ticketId} resolved`,
      });
      setResolvingGrievance(null);
      setResolutionText("");
      await fetchGrievances();
    } catch (error) {
      console.error("Error resolving grievance:", error);
      toast({
        title: "Error",
        description: "Failed to resolve grievance",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = async () => {
    if (!tenantId || !dismissingGrievance) return;

    try {
      const docRef = doc(db, `tenants/${tenantId}/grievances`, dismissingGrievance.id);
      await updateDoc(docRef, {
        status: "dismissed",
        updatedAt: serverTimestamp(),
      });
      toast({
        title: "Success",
        description: `Grievance ${dismissingGrievance.ticketId} dismissed`,
      });
      setDismissingGrievance(null);
      await fetchGrievances();
    } catch (error) {
      console.error("Error dismissing grievance:", error);
      toast({
        title: "Error",
        description: "Failed to dismiss grievance",
        variant: "destructive",
      });
    }
  };

  const toggleExpandRow = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Filter grievances based on active tab
  const filteredGrievances = grievances.filter((g) => {
    switch (activeTab) {
      case "new":
        return g.status === "submitted";
      case "reviewing":
        return g.status === "reviewing";
      case "resolved":
        return g.status === "resolved" || g.status === "dismissed";
      default:
        return true;
    }
  });

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 mx-auto max-w-screen-2xl">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <Skeleton className="h-10 w-96 mb-6" />
          <div className="grid gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Grievance Inbox - Meza"
        description="Anonymous employee grievance management"
      />
      <MainNavigation />

      <div className="p-6 mx-auto max-w-screen-2xl">
        <PageHeader
          title="Grievance Inbox"
          subtitle="Anonymous employee concerns and complaints"
          icon={ShieldAlert}
          iconColor="text-blue-500"
        />

        {/* Anonymity Notice */}
        <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Reports are anonymous. Employee identities are not recorded.
          </AlertDescription>
        </Alert>

        {/* Status Filter */}
        <div className="mb-6">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-[160px] h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewing">In Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grievances Table */}
        {filteredGrievances.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">
                {activeTab === "all"
                  ? "No grievances submitted"
                  : `No ${activeTab === "new" ? "new" : activeTab === "reviewing" ? "in-review" : "resolved"} grievances`}
              </h3>
              <p className="text-muted-foreground">
                {activeTab === "all"
                  ? "Employee grievances submitted via Ekipa will appear here."
                  : "Try switching to a different filter tab."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead className="w-[120px]">Ticket ID</TableHead>
                  <TableHead className="w-[140px]">Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[120px]">Submitted</TableHead>
                  <TableHead className="w-[220px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrievances.map((grievance) => (
                  <React.Fragment key={grievance.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpandRow(grievance.id)}
                    >
                      <TableCell className="px-2">
                        {expandedRow === grievance.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {grievance.ticketId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={CATEGORY_CONFIG[grievance.category]?.color || ""}
                        >
                          {CATEGORY_CONFIG[grievance.category]?.label || grievance.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {truncateText(grievance.description, 60)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_CONFIG[grievance.status]?.color || ""}
                        >
                          {STATUS_CONFIG[grievance.status]?.label || grievance.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTL(grievance.createdAt, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {grievance.status === "submitted" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartReview(grievance)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Start Review
                            </Button>
                          )}
                          {(grievance.status === "submitted" || grievance.status === "reviewing") && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                                onClick={() => {
                                  setResolvingGrievance(grievance);
                                  setResolutionText("");
                                }}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Resolve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                onClick={() => setDismissingGrievance(grievance)}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Dismiss
                              </Button>
                            </>
                          )}
                          {grievance.status === "resolved" && (
                            <span className="text-xs text-green-600 font-medium px-2">
                              Resolved
                            </span>
                          )}
                          {grievance.status === "dismissed" && (
                            <span className="text-xs text-gray-500 font-medium px-2">
                              Dismissed
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row */}
                    {expandedRow === grievance.id && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={7} className="py-4">
                          <div className="pl-10 space-y-3">
                            <div>
                              <p className="text-sm font-medium mb-1">Full Description</p>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {grievance.description}
                              </p>
                            </div>
                            {grievance.resolution && (
                              <div className="border-t pt-3">
                                <p className="text-sm font-medium mb-1">Resolution Notes</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {grievance.resolution}
                                </p>
                                {grievance.resolvedAt && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Resolved on{" "}
                                    {formatDateTL(grievance.resolvedAt, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Resolve Dialog */}
      <Dialog
        open={!!resolvingGrievance}
        onOpenChange={(open) => {
          if (!open) {
            setResolvingGrievance(null);
            setResolutionText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Resolve Grievance</DialogTitle>
            <DialogDescription>
              Provide resolution notes for grievance {resolvingGrievance?.ticketId}. This will mark
              the case as resolved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Original Complaint</p>
              <p className="text-sm">{truncateText(resolvingGrievance?.description || "", 200)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolution-text">Resolution Notes *</Label>
              <Textarea
                id="resolution-text"
                placeholder="Describe what actions were taken to resolve this grievance..."
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {resolutionText.length}/2000
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResolvingGrievance(null);
                setResolutionText("");
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={saving || resolutionText.trim().length < 10}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? "Saving..." : "Mark as Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss Confirmation Dialog */}
      <AlertDialog
        open={!!dismissingGrievance}
        onOpenChange={(open) => {
          if (!open) setDismissingGrievance(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Grievance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to dismiss grievance {dismissingGrievance?.ticketId}? This
              indicates the report has been reviewed but no further action will be taken. This action
              can be reviewed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDismiss}>Dismiss</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
