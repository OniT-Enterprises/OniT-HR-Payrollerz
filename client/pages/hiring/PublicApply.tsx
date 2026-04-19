import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, CheckCircle, MapPin, DollarSign, Send } from "lucide-react";
import { type Job } from "@/services/jobService";
import { fileUploadService } from "@/services/fileUploadService";
import { jobApplicationService } from "@/services/jobApplicationService";
import { useToast } from "@/hooks/use-toast";

/**
 * Public candidate application page.
 * Rendered outside authenticated layout — fetches the job (must be open)
 * and lets anyone submit name/email/phone/cover note.
 */
export default function PublicApply() {
  const { jobId = "" } = useParams();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    coverNote: "",
    linkedInUrl: "",
    referredBy: "",
  });
  const [documents, setDocuments] = useState<{
    resume: File | null;
    idDocument: File | null;
  }>({
    resume: null,
    idDocument: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!jobId) return;
      try {
        const { doc, getDoc, Timestamp } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const snap = await getDoc(doc(db, "jobs", jobId));
        if (cancelled) return;
        if (!snap.exists()) {
          setError("This job listing was not found.");
          setLoading(false);
          return;
        }
        const data = snap.data();
        if (data.status !== "open") {
          setError("This role is no longer accepting applications.");
          setLoading(false);
          return;
        }
        const createdAt =
          data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt;
        setJob({ id: snap.id, ...(data as Omit<Job, "id">), createdAt });
      } catch {
        if (!cancelled) setError("Could not load this job.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !job.id) return;
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast({
        title: "Missing details",
        description: "Name, email and phone are required.",
        variant: "destructive",
      });
      return;
    }
    if (!documents.resume || !documents.idDocument) {
      toast({
        title: "Documents required",
        description: "Upload your CV/resume and one ID document before submitting.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const resumeValidation = fileUploadService.validateDocumentFile(
        documents.resume,
        [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        10,
      );
      if (!resumeValidation.valid) {
        throw new Error(resumeValidation.error);
      }

      const idValidation = fileUploadService.validateDocumentFile(
        documents.idDocument,
        ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        10,
      );
      if (!idValidation.valid) {
        throw new Error(idValidation.error);
      }

      const uid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const resumeExt = documents.resume.name.split(".").pop() || "pdf";
      const idExt = documents.idDocument.name.split(".").pop() || "pdf";
      const basePath = `public/jobApplications/${job.tenantId}/${job.id}/${uid}`;
      const [resumePath, idDocumentPath] = await Promise.all([
        fileUploadService.uploadFileAndReturnPath(
          documents.resume,
          `${basePath}/resume.${resumeExt}`,
        ),
        fileUploadService.uploadFileAndReturnPath(
          documents.idDocument,
          `${basePath}/id_document.${idExt}`,
        ),
      ]);

      await jobApplicationService.submitPublic({
        tenantId: job.tenantId,
        jobId: job.id,
        jobTitle: job.title,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        coverNote: form.coverNote.trim() || undefined,
        linkedInUrl: form.linkedInUrl.trim() || undefined,
        referredBy: form.referredBy.trim() || undefined,
        resumePath,
        idDocumentPath,
      });
      setSubmitted(true);
    } catch (err) {
      toast({
        title: "Submission failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/20 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted && job) {
    return (
      <div className="min-h-screen bg-muted/20 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 rounded-full bg-emerald-500/10 p-3 w-fit">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <CardTitle>Application submitted</CardTitle>
            <CardDescription>
              Thanks — {job.title}. The hiring team will review your details and get in touch.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!job) return null;

  const salaryLabel =
    job.salaryMin || job.salaryMax
      ? job.salaryMin && job.salaryMax
        ? `$${job.salaryMin.toLocaleString()} – $${job.salaryMax.toLocaleString()} /mo`
        : `$${(job.salaryMin || job.salaryMax)?.toLocaleString()} /mo`
      : null;

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Briefcase className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl">{job.title}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-3 mt-2">
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                  )}
                  {job.employmentType && <Badge variant="outline">{job.employmentType}</Badge>}
                  {job.contractType && <Badge variant="outline">{job.contractType}</Badge>}
                  {salaryLabel && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      {salaryLabel}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {job.description && (
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                {job.description}
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Apply</CardTitle>
            <CardDescription>
              Fill in your details below. The hiring team will review and contact shortlisted
              candidates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Full name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={200}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Mobile <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                    maxLength={80}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverNote">Why are you a good fit?</Label>
                <Textarea
                  id="coverNote"
                  value={form.coverNote}
                  onChange={(e) => setForm({ ...form, coverNote: e.target.value })}
                  rows={5}
                  maxLength={3000}
                  placeholder="A few lines about your experience and why you're applying."
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="linkedInUrl">LinkedIn profile (optional)</Label>
                  <Input
                    id="linkedInUrl"
                    type="url"
                    value={form.linkedInUrl}
                    onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/…"
                    maxLength={400}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referredBy">Referred by (optional)</Label>
                  <Input
                    id="referredBy"
                    value={form.referredBy}
                    onChange={(e) => setForm({ ...form, referredBy: e.target.value })}
                    placeholder="Name of employee who referred you"
                    maxLength={200}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resume">
                    CV / resume <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="resume"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) =>
                      setDocuments((prev) => ({
                        ...prev,
                        resume: e.target.files?.[0] ?? null,
                      }))
                    }
                  />
                  {documents.resume && (
                    <p className="text-xs text-muted-foreground">{documents.resume.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idDocument">
                    ID document <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="idDocument"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) =>
                      setDocuments((prev) => ({
                        ...prev,
                        idDocument: e.target.files?.[0] ?? null,
                      }))
                    }
                  />
                  {documents.idDocument && (
                    <p className="text-xs text-muted-foreground">{documents.idDocument.name}</p>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit application
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By submitting you agree your details and uploaded documents will be reviewed by the hiring team.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
