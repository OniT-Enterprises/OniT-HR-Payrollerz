import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from "@/components/layout/PageHeader";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAddCandidate } from "@/hooks/useHiring";
import { fileUploadService } from "@/services/fileUploadService";
import {
  jobApplicationService,
  type JobApplication,
} from "@/services/jobApplicationService";
import {
  UserCheck,
  Share2,
  Mail,
  Phone,
  Linkedin,
  Users,
  Check,
  X,
  ClipboardCheck,
} from "lucide-react";

export default function JobApplicationsReview() {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addCandidate = useAddCandidate();

  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [selected, setSelected] = useState<JobApplication | null>(null);
  const [docChecks, setDocChecks] = useState({
    idVerified: false,
    contactVerified: false,
    eligibilityConfirmed: false,
  });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["jobApplications", tenantId, tab],
    queryFn: () =>
      tab === "pending"
        ? jobApplicationService.getPending(tenantId)
        : jobApplicationService.getAll(tenantId),
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: allApplications = [] } = useQuery({
    queryKey: ["jobApplications", tenantId, "stats"],
    queryFn: () => jobApplicationService.getAll(tenantId),
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });

  const selectApplication = (app: JobApplication | null) => {
    setSelected(app);
    setDocChecks(
      app?.verificationChecklist ?? {
        idVerified: false,
        contactVerified: false,
        eligibilityConfirmed: false,
      },
    );
  };

  const verifyMutation = useMutation({
    mutationFn: async (app: JobApplication) => {
      if (!app.id) throw new Error("Missing id");
      const candidateId = await addCandidate.mutateAsync({
        name: app.name,
        email: app.email,
        phone: app.phone,
        position: app.jobTitle,
        experience: "",
        score: 0,
        status: "Shortlisted",
        appliedDate: new Date().toISOString().slice(0, 10),
        resume: app.resumePath?.split("/").pop() || "application_resume",
        avatar: "",
        cvQuality: 0,
        coverLetter: app.coverNote ? 50 : 0,
        technicalSkills: 0,
        interviewScore: null,
        totalScore: 0,
        notes: [
          app.coverNote ? `Cover note: ${app.coverNote}` : "",
          app.linkedInUrl ? `LinkedIn: ${app.linkedInUrl}` : "",
          app.referredBy ? `Referred by: ${app.referredBy}` : "",
          app.resumePath ? `Resume on file: ${app.resumePath}` : "",
          app.idDocumentPath ? `ID document on file: ${app.idDocumentPath}` : "",
          "Source: public application (verified)",
        ]
          .filter(Boolean)
          .join("\n"),
      });
      await jobApplicationService.verify(tenantId, app.id, user?.email || "unknown", {
        candidateId,
        verificationChecklist: docChecks,
      });
      return candidateId;
    },
    onSuccess: (candidateId) => {
      queryClient.invalidateQueries({ queryKey: ["jobApplications", tenantId] });
      toast({
        title: "Verified & candidate created",
        description: "Starting onboarding with the approved candidate.",
      });
      setSelected(null);
      setDocChecks({ idVerified: false, contactVerified: false, eligibilityConfirmed: false });
      navigate(`/people/onboarding?candidateId=${candidateId}`);
    },
    onError: (err) => {
      toast({
        title: "Verification failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ app, reason }: { app: JobApplication; reason: string }) => {
      if (!app.id) throw new Error("Missing id");
      await jobApplicationService.reject(tenantId, app.id, user?.email || "unknown", reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobApplications", tenantId] });
      toast({ title: "Application rejected" });
      setRejectOpen(false);
      setRejectReason("");
      setSelected(null);
    },
    onError: (err) => {
      toast({
        title: "Could not reject",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const pendingCount = allApplications.filter((a) => a.status === "pending").length;
  const verifiedCount = allApplications.filter((a) => a.status === "verified").length;

  const copyApplyLink = async (app: JobApplication) => {
    const url = `${window.location.origin}/apply/${app.jobId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Apply link copied", description: url });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const openStoredDocument = async (path: string) => {
    try {
      const url = await fileUploadService.getDownloadUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        title: "Document unavailable",
        description: error instanceof Error ? error.message : "Could not open the file.",
        variant: "destructive",
      });
    }
  };

  const handleVerify = () => {
    if (!selected) return;
    if (!docChecks.idVerified || !docChecks.contactVerified || !docChecks.eligibilityConfirmed) {
      toast({
        title: "All checks required",
        description: "Confirm ID, contact and eligibility before verifying.",
        variant: "destructive",
      });
      return;
    }
    verifyMutation.mutate(selected);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-screen-2xl px-6 py-5">
        <PageHeader
          title="Public applications"
          subtitle="Review candidate submissions before moving them into the pipeline"
          icon={UserCheck}
          iconColor="text-blue-500"
        />

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending review</CardDescription>
              <CardTitle className="text-3xl">{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Verified</CardDescription>
              <CardTitle className="text-3xl">{verifiedCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            variant={tab === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("pending")}
          >
            Pending ({pendingCount})
          </Button>
          <Button
            variant={tab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("all")}
          >
            All
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground space-y-3">
              <Users className="h-10 w-10 mx-auto opacity-40" />
              <p>No applications yet.</p>
              <p className="text-xs">
                Share <code>/apply/:jobId</code> on Facebook, WhatsApp or LinkedIn.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <Card
                key={app.id}
                className="border-border/50 hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => selectApplication(app)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold">{app.name}</h4>
                        <Badge
                          variant={
                            app.status === "pending"
                              ? "outline"
                              : app.status === "verified"
                                ? "default"
                                : "secondary"
                          }
                          className={
                            app.status === "verified" ? "bg-emerald-500 text-white" : ""
                          }
                        >
                          {app.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Applied for <span className="text-foreground">{app.jobTitle}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {app.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {app.phone}
                        </span>
                        {app.linkedInUrl && (
                          <span className="flex items-center gap-1">
                            <Linkedin className="h-3 w-3" />
                            LinkedIn
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyApplyLink(app);
                      }}
                    >
                      <Share2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Review dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && selectApplication(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Verify application — {selected.name}</DialogTitle>
                <DialogDescription>
                  Confirm identity, contact details and work eligibility before moving into the
                  candidate pipeline.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Job</Label>
                    <div className="font-medium">{selected.jobTitle}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Applied</Label>
                    <div className="font-medium">
                      {selected.createdAt
                        ? new Date(selected.createdAt).toLocaleDateString("en-GB")
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="font-medium break-all">{selected.email}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <div className="font-medium">{selected.phone}</div>
                  </div>
                  {selected.linkedInUrl && (
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">LinkedIn</Label>
                      <a
                        href={selected.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline break-all"
                      >
                        {selected.linkedInUrl}
                      </a>
                    </div>
                  )}
                  {selected.referredBy && (
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Referred by</Label>
                      <div className="font-medium">{selected.referredBy}</div>
                    </div>
                  )}
                  {selected.coverNote && (
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Cover note</Label>
                      <div className="rounded-lg border border-border/50 p-3 bg-muted/30 text-sm whitespace-pre-wrap">
                        {selected.coverNote}
                      </div>
                    </div>
                  )}
                  {(selected.resumePath || selected.idDocumentPath) && (
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Submitted documents</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selected.resumePath && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openStoredDocument(selected.resumePath!)}
                          >
                            Open resume
                          </Button>
                        )}
                        {selected.idDocumentPath && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openStoredDocument(selected.idDocumentPath!)}
                          >
                            Open ID document
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selected.status === "pending" && (
                  <div className="rounded-lg border border-border/50 p-4 space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Document verification
                    </h4>
                    <div className="space-y-2 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={docChecks.idVerified}
                          onChange={(e) =>
                            setDocChecks({ ...docChecks, idVerified: e.target.checked })
                          }
                        />
                        ID document (Bilhete, Electoral Card, or Passport) sighted
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={docChecks.contactVerified}
                          onChange={(e) =>
                            setDocChecks({ ...docChecks, contactVerified: e.target.checked })
                          }
                        />
                        Phone and email verified (test call / test email sent)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={docChecks.eligibilityConfirmed}
                          onChange={(e) =>
                            setDocChecks({ ...docChecks, eligibilityConfirmed: e.target.checked })
                          }
                        />
                        Eligible to work (TL national or valid work permit)
                      </label>
                    </div>
                  </div>
                )}

                {selected.status === "verified" && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Already verified — candidate record has been created.
                  </div>
                )}

                {selected.status === "rejected" && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
                    <div className="font-medium text-destructive">Rejected</div>
                    {selected.rejectionReason && (
                      <div className="text-muted-foreground mt-1">{selected.rejectionReason}</div>
                    )}
                  </div>
                )}
              </div>

              {selected.status === "pending" && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRejectOpen(true)}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    onClick={handleVerify}
                    disabled={verifyMutation.isPending}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Check className="h-4 w-4" />
                    {verifyMutation.isPending ? "Verifying…" : "Verify & create candidate"}
                  </Button>
                </DialogFooter>
              )}
              {selected.status === "verified" && (
                <DialogFooter>
                  {selected.candidateId && (
                    <Button
                      onClick={() => navigate(`/people/onboarding?candidateId=${selected.candidateId}`)}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Start onboarding
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => navigate("/people/candidates")} className="gap-2">
                    Go to candidates
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject application</DialogTitle>
            <DialogDescription>
              The candidate won't see this — it's only for your records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">Reason</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Under-qualified, overseas applicant, duplicate…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() =>
                selected &&
                rejectMutation.mutate({ app: selected, reason: rejectReason.trim() })
              }
            >
              {rejectMutation.isPending ? "Rejecting…" : "Reject application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
