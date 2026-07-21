import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Share2,
  UserPlus,
  Users,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import {
  useCandidates,
  useCreateInterview,
  useInterviews,
  useInvalidateJobApplications,
  useJobApplications,
  useJobs,
  useUpdateInterview,
  useUpdateJob,
} from "@/hooks/useHiring";
import { fileUploadService } from "@/services/fileUploadService";
import { jobApplicationService, type JobApplication } from "@/services/jobApplicationService";
import { notificationService } from "@/services/notificationService";
import { jobPrivateDetailsService } from "@/services/jobPrivateDetailsService";
import {
  DEFAULT_PRE_CHECKS,
  interviewService,
  type Interview,
  type InterviewType,
} from "@/services/interviewService";
import type { Candidate } from "@/services/candidateService";
import type { Job, JobStatus } from "@/services/jobService";
import { getTodayTL } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

type ApplicantStage = "new" | "shortlisted" | "interview" | "ready" | "hired" | "rejected";

const STAGE_LABEL: Record<ApplicantStage, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  interview: "Interview",
  ready: "Ready to hire",
  hired: "Hired",
  rejected: "Not selected",
};

const STAGE_STYLE: Record<ApplicantStage, string> = {
  new: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200",
  shortlisted: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
  interview: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  hired: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200",
  rejected: "border-border bg-muted text-muted-foreground",
};

function applicantStage(
  application: JobApplication,
  candidate?: Candidate,
  interview?: Interview,
): ApplicantStage {
  if (application.status === "rejected" || candidate?.status === "Rejected" || interview?.decision === "reject") {
    return "rejected";
  }
  if (application.status === "hired" || candidate?.status === "Hired") return "hired";
  if (interview?.decision === "hire") return "ready";
  if (interview) return "interview";
  if (
    application.status === "shortlisted" ||
    application.status === "verified" ||
    candidate
  ) return "shortlisted";
  return "new";
}

function formatDate(value?: string | Date) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts.shift() || "",
    lastName: parts.join(" "),
  };
}

function jobStatusStyle(status: JobStatus) {
  if (status === "open") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200";
  if (status === "filled") return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200";
  return "border-border bg-muted text-muted-foreground";
}

export default function HiringWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = useTenantId();
  const { session, hasModule, canManage } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  const jobsQuery = useJobs();
  const applicationsQuery = useJobApplications();
  const candidatesQuery = useCandidates();
  const interviewsQuery = useInterviews();
  const updateJob = useUpdateJob();
  const createInterview = useCreateInterview();
  const updateInterview = useUpdateInterview();
  const invalidateApplications = useInvalidateJobApplications();

  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data]);
  const applications = useMemo(() => applicationsQuery.data ?? [], [applicationsQuery.data]);
  const candidates = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);
  const interviews = useMemo(() => interviewsQuery.data ?? [], [interviewsQuery.data]);
  const loading =
    jobsQuery.isLoading ||
    applicationsQuery.isLoading ||
    candidatesQuery.isLoading ||
    interviewsQuery.isLoading;

  const requestedJobId = searchParams.get("job");
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === requestedJobId) ?? jobs.find((job) => job.status === "open") ?? jobs[0],
    [jobs, requestedJobId],
  );

  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [scheduleApplication, setScheduleApplication] = useState<JobApplication | null>(null);
  const [scheduleCandidateId, setScheduleCandidateId] = useState("");
  const [scheduleInterviewId, setScheduleInterviewId] = useState("");
  const [scheduleForm, setScheduleForm] = useState({
    date: "",
    time: "",
    type: "in_person" as InterviewType,
    location: "",
    duration: "45",
    notify: true,
  });
  const [rejectApplication, setRejectApplication] = useState<JobApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const candidateById = useMemo(
    () => new Map(candidates.filter((candidate) => candidate.id).map((candidate) => [candidate.id!, candidate])),
    [candidates],
  );

  const latestInterviewFor = useCallback(
    (application: JobApplication) =>
      interviews.find(
        (interview) =>
          (application.candidateId && interview.candidateId === application.candidateId) ||
          (interview.jobId === application.jobId &&
            interview.candidateEmail.toLowerCase() === application.email.toLowerCase()),
      ),
    [interviews],
  );

  const selectedApplications = useMemo(() => {
    if (!selectedJob?.id) return [];
    const stageOrder: Record<ApplicantStage, number> = {
      new: 0,
      ready: 1,
      interview: 2,
      shortlisted: 3,
      hired: 4,
      rejected: 5,
    };
    return applications
      .filter((application) => application.jobId === selectedJob.id)
      .sort((a, b) => {
        const aStage = applicantStage(a, a.candidateId ? candidateById.get(a.candidateId) : undefined, latestInterviewFor(a));
        const bStage = applicantStage(b, b.candidateId ? candidateById.get(b.candidateId) : undefined, latestInterviewFor(b));
        return stageOrder[aStage] - stageOrder[bStage];
      });
  }, [applications, candidateById, latestInterviewFor, selectedJob]);

  const pendingCount = applications.filter((application) => application.status === "pending").length;
  const openJobsCount = jobs.filter((job) => job.status === "open").length;
  const canAddEmployee = hasModule("staff") && canManage();
  const companyName =
    session?.config?.tradingName || session?.config?.legalName || session?.config?.name || "the company";

  const chooseJob = (job: Job) => {
    if (!job.id) return;
    const next = new URLSearchParams(searchParams);
    next.set("job", job.id);
    setSearchParams(next, { replace: true });
  };

  const copyApplyLink = async (job: Job) => {
    if (!job.id) return;
    const url = `${window.location.origin}/apply/${job.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Application link copied", description: "Share it by WhatsApp, Facebook, or email." });
    } catch {
      toast({ title: "Could not copy the link", description: url, variant: "destructive" });
    }
  };

  const toggleJobStatus = async (job: Job) => {
    if (!job.id) return;
    const status: JobStatus = job.status === "open" ? "closed" : "open";
    setBusyAction(`job:${job.id}`);
    try {
      await updateJob.mutateAsync({ id: job.id, updates: { status } });
      toast({ title: status === "open" ? "Job reopened" : "Job closed" });
    } catch (error) {
      toast({
        title: "Could not update the job",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const sendOutcomeEmail = async (application: JobApplication, outcome: "shortlisted" | "rejected") => {
    if (!application.email.trim()) return;
    const shortlisted = outcome === "shortlisted";
    try {
      await notificationService.queueEmail({
        tenantId,
        to: application.email,
        replyTo: user?.email || undefined,
        subject: shortlisted
          ? `Next step for your ${application.jobTitle} application at ${companyName}`
          : `Update on your ${application.jobTitle} application at ${companyName}`,
        text: shortlisted
          ? [
              `Dear ${application.name},`,
              "",
              `We would like to move your application for ${application.jobTitle} to the next step. We will contact you with interview details shortly.`,
              "",
              `Ami hakarak avansa ita-nia aplikasaun ba ${application.jobTitle}. Ami sei kontaktu ita ho informasaun entrevista.`,
              "",
              `— ${companyName}`,
            ].join("\n")
          : [
              `Dear ${application.name},`,
              "",
              `Thank you for applying for ${application.jobTitle}. We will not be moving forward on this occasion, but we appreciate the time you took to apply.`,
              "",
              `Obrigadu ba ita-nia aplikasaun ba ${application.jobTitle}. Iha biban ida ne'e ami la avansa, maibé ami agradese ita-nia tempu.`,
              "",
              `— ${companyName}`,
            ].join("\n"),
        purpose: "application-outcome",
        relatedId: application.id,
      });
    } catch (error) {
      console.error("Hiring outcome email failed:", error);
    }
  };

  const ensureCandidate = async (application: JobApplication) => {
    if (application.candidateId) return application.candidateId;
    if (!application.id) throw new Error("Application id is missing");
    const candidateId = await jobApplicationService.shortlist(
      tenantId,
      application.id,
      user?.email || user?.uid || "unknown",
      {
      name: application.name,
      email: application.email,
      phone: application.phone,
      position: application.jobTitle,
      experience: "",
      score: 0,
      status: "Shortlisted",
      appliedDate: application.createdAt
        ? application.createdAt.toISOString().slice(0, 10)
        : getTodayTL(),
      resume: application.resumePath?.split("/").pop() || "application_resume",
      avatar: "",
      cvQuality: 0,
      coverLetter: application.coverNote ? 50 : 0,
      technicalSkills: 0,
      interviewScore: null,
      totalScore: 0,
      notes: [
        application.coverNote ? `Cover note: ${application.coverNote}` : "",
        application.linkedInUrl ? `LinkedIn: ${application.linkedInUrl}` : "",
        application.referredBy ? `Referred by: ${application.referredBy}` : "",
        application.resumePath ? `Resume on file: ${application.resumePath}` : "",
        "Source: public application",
      ]
        .filter(Boolean)
        .join("\n"),
      },
    );
    await candidatesQuery.refetch();
    await invalidateApplications();
    await sendOutcomeEmail(application, "shortlisted");
    return candidateId;
  };

  const shortlist = async (application: JobApplication) => {
    setBusyAction(`shortlist:${application.id}`);
    try {
      await ensureCandidate(application);
      toast({ title: "Moved to shortlist", description: "The applicant is ready for an interview." });
      setSelectedApplication(null);
    } catch (error) {
      toast({
        title: "Could not move the applicant",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const openSchedule = async (application: JobApplication, existing?: Interview) => {
    setBusyAction(`schedule:${application.id}`);
    try {
      const candidateId = await ensureCandidate(application);
      setScheduleCandidateId(candidateId);
      setScheduleInterviewId(existing?.id || "");
      setScheduleApplication({ ...application, candidateId });
      setScheduleForm({
        date: existing?.interviewDate || "",
        time: existing?.interviewTime || "",
        type: existing?.interviewType || "in_person",
        location: existing?.location || existing?.meetingLink || "",
        duration: String(existing?.duration || 45),
        notify: true,
      });
      setSelectedApplication(null);
    } catch (error) {
      toast({
        title: "Could not prepare the interview",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const saveInterview = async () => {
    const application = scheduleApplication;
    if (!application || !scheduleForm.date || !scheduleForm.time) {
      toast({ title: "Choose a date and time", variant: "destructive" });
      return;
    }
    setBusyAction("save-interview");
    const location = scheduleForm.type === "video" ? "" : scheduleForm.location.trim();
    const meetingLink = scheduleForm.type === "video" ? scheduleForm.location.trim() : "";
    try {
      const scheduleData = {
        candidateId: scheduleCandidateId,
        candidateName: application.name,
        candidateEmail: application.email,
        candidatePhone: application.phone,
        position: application.jobTitle,
        jobId: application.jobId,
        interviewDate: scheduleForm.date,
        interviewTime: scheduleForm.time,
        duration: Number(scheduleForm.duration),
        interviewType: scheduleForm.type,
        location,
        meetingLink,
        interviewerIds: user?.uid ? [user.uid] : [],
        interviewerNames: [user?.displayName || user?.email || "Hiring manager"],
      };

      let savedInterviewId = scheduleInterviewId;
      if (scheduleInterviewId) {
        // Editing the schedule must not erase pre-checks, confirmation,
        // reminder history, feedback, or the original creator.
        await updateInterview.mutateAsync({ id: scheduleInterviewId, updates: scheduleData });
      } else {
        savedInterviewId = await createInterview.mutateAsync({
          ...scheduleData,
          preChecks: DEFAULT_PRE_CHECKS,
          invitationSent: false,
          reminderSent: false,
          candidateConfirmed: false,
          followUpCall: false,
          createdBy: user?.uid || "unknown",
        });
      }

      let invitationResult: "sent" | "not-requested" | "no-email" | "failed" =
        "not-requested";
      if (scheduleForm.notify && application.email.trim()) {
        const existingInterview = interviews.find(
          (interview) => interview.id === savedInterviewId,
        );
        try {
          const emailed = await interviewService.sendInvitation(
            tenantId,
            {
              ...existingInterview,
              ...scheduleData,
              id: savedInterviewId,
              tenantId,
              status: existingInterview?.status || "scheduled",
              feedback: existingInterview?.feedback || [],
              preChecks: existingInterview?.preChecks || DEFAULT_PRE_CHECKS,
              invitationSent: existingInterview?.invitationSent || false,
              reminderSent: existingInterview?.reminderSent || false,
              candidateConfirmed: existingInterview?.candidateConfirmed || false,
              followUpCall: existingInterview?.followUpCall || false,
              createdBy: existingInterview?.createdBy || user?.uid || "unknown",
            },
            {
              companyName,
              replyTo: user?.email || undefined,
            },
          );
          invitationResult = emailed ? "sent" : "no-email";
          if (emailed) await interviewsQuery.refetch();
        } catch (error) {
          invitationResult = "failed";
          console.error("Interview invitation email failed:", error);
        }
      } else if (scheduleForm.notify) {
        invitationResult = "no-email";
      }

      toast({
        title: scheduleInterviewId ? "Interview updated" : "Interview scheduled",
        description:
          invitationResult === "sent"
            ? "The invitation email was queued."
            : invitationResult === "failed"
              ? "The interview was saved, but the invitation email failed. Contact the applicant directly or retry."
              : invitationResult === "no-email"
                ? "The interview was saved, but no invitation was sent because there is no email address."
                : undefined,
        variant: invitationResult === "failed" ? "destructive" : undefined,
      });
      setScheduleApplication(null);
      setScheduleCandidateId("");
      setScheduleInterviewId("");
    } catch (error) {
      toast({
        title: "Could not save the interview",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const markReadyToHire = async (application: JobApplication, interview: Interview) => {
    if (!interview.id) return;
    setBusyAction(`hire:${application.id}`);
    try {
      await updateInterview.mutateAsync({
        id: interview.id,
        updates: { status: "completed", decision: "hire" },
      });
      toast({ title: "Ready to hire", description: "Add the applicant as an employee when the offer is accepted." });
      setSelectedApplication(null);
    } catch (error) {
      toast({
        title: "Could not save the decision",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const reject = async () => {
    const application = rejectApplication;
    if (!application?.id || !rejectReason.trim()) return;
    setBusyAction("reject");
    try {
      await jobApplicationService.reject(
        tenantId,
        application.id,
        user?.email || user?.uid || "unknown",
        rejectReason.trim(),
        {
          candidateId: application.candidateId,
          interviewId: latestInterviewFor(application)?.id,
        },
      );
      await Promise.all([
        invalidateApplications(),
        candidatesQuery.refetch(),
        interviewsQuery.refetch(),
      ]);
      await sendOutcomeEmail(application, "rejected");
      toast({ title: "Applicant marked as not selected" });
      setRejectApplication(null);
      setRejectReason("");
      setSelectedApplication(null);
    } catch (error) {
      toast({
        title: "Could not save the decision",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const openResume = async (application: JobApplication) => {
    if (!application.resumePath) return;
    try {
      const url = await fileUploadService.getDownloadUrl(application.resumePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        title: "CV unavailable",
        description: error instanceof Error ? error.message : "Could not open the file.",
        variant: "destructive",
      });
    }
  };

  const startEmployee = async (application: JobApplication) => {
    setBusyAction(`employee:${application.id}`);
    try {
      const job = jobs.find((item) => item.id === application.jobId);
      if (!job) throw new Error("The linked job could not be found.");
      const privateDetails = await jobPrivateDetailsService.getForJob(
        tenantId,
        application.jobId,
      );
      if (!privateDetails) {
        throw new Error("The contract and probation details for this job are missing.");
      }
      const name = splitName(application.name);
      const params = new URLSearchParams({
        candidateId: application.candidateId || "",
        applicationId: application.id || "",
        firstName: name.firstName,
        lastName: name.lastName,
        email: application.email,
        phone: application.phone,
        jobTitle: application.jobTitle,
        jobId: application.jobId,
        department: job.department,
        employmentType: job.employmentType || "Full-time",
        salary: job.salaryMin ? String(job.salaryMin) : "",
        contractType: privateDetails.contractType,
        contractDurationMonths: privateDetails.contractDurationMonths
          ? String(privateDetails.contractDurationMonths)
          : "",
        probationDays: String(privateDetails.probationDays),
      });
      navigate(`/people/add?${params.toString()}`);
    } catch (error) {
      toast({
        title: "Could not start the employee record",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const renderApplicantAction = (application: JobApplication) => {
    const candidate = application.candidateId ? candidateById.get(application.candidateId) : undefined;
    const interview = latestInterviewFor(application);
    const stage = applicantStage(application, candidate, interview);
    if (stage === "new") return "Review";
    if (stage === "shortlisted") return "Schedule interview";
    if (stage === "interview") return "View interview";
    if (stage === "ready") return canAddEmployee ? "Add employee" : "View";
    return "View";
  };

  const selectedCandidate = selectedApplication?.candidateId
    ? candidateById.get(selectedApplication.candidateId)
    : undefined;
  const selectedInterview = selectedApplication ? latestInterviewFor(selectedApplication) : undefined;
  const selectedStage = selectedApplication
    ? applicantStage(selectedApplication, selectedCandidate, selectedInterview)
    : undefined;

  if (
    jobsQuery.isError ||
    applicationsQuery.isError ||
    candidatesQuery.isError ||
    interviewsQuery.isError
  ) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title="Hiring"
            subtitle="Post a job, review applicants, and schedule the next step."
            icon={Briefcase}
            iconColor="text-blue-600"
          />
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Could not load the complete hiring pipeline. No empty state is being assumed.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  void jobsQuery.refetch();
                  void applicationsQuery.refetch();
                  void candidatesQuery.refetch();
                  void interviewsQuery.refetch();
                }}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title="Hiring"
          subtitle="Post a job, review applicants, and schedule the next step."
          icon={Briefcase}
          iconColor="text-blue-600"
          actions={
            <Button onClick={() => navigate("/people/jobs/new")} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              New job
            </Button>
          }
        />

        <Card
          className={cn(
            "mb-5",
            pendingCount > 0
              ? "bg-amber-50/60 dark:bg-amber-950/20"
              : "bg-emerald-50/50 dark:bg-emerald-950/20",
          )}
        >
          <CardContent className="flex items-center gap-3 p-4">
            {pendingCount > 0 ? (
              <Clock3 className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            )}
            <div className="min-w-0">
              <p className="font-medium">
                {pendingCount > 0
                  ? `${pendingCount} ${pendingCount === 1 ? "application needs" : "applications need"} review`
                  : "You’re all caught up"}
              </p>
              <p className="text-sm text-muted-foreground">
                {openJobsCount} open {openJobsCount === 1 ? "job" : "jobs"}
              </p>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="mt-2 h-4 w-20" />
                  </div>
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-2 pt-0 sm:p-3 sm:pt-0">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="rounded-lg border border-transparent px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-6 shrink-0 rounded-full" />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="mt-2 h-4 w-48" />
                  </div>
                  <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
                  <div>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="mt-2 h-3 w-16" />
                  </div>
                </div>
                <div className="divide-y">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex w-full items-center gap-3 px-4 py-4 sm:px-6">
                      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                        <Skeleton className="mt-2 h-3 w-36" />
                      </div>
                      <Skeleton className="hidden h-4 w-24 shrink-0 sm:block" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : jobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-4 rounded-2xl bg-blue-100 p-4 dark:bg-blue-950/60">
                <Briefcase className="h-8 w-8 text-blue-700 dark:text-blue-300" />
              </div>
              <h2 className="text-lg font-semibold">Create your first job</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Add the role once, then share one link and review every applicant here.
              </p>
              <Button onClick={() => navigate("/people/jobs/new")} className="mt-5 gap-2 bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                New job
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Jobs</CardTitle>
                    <CardDescription>{jobs.length} total</CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => navigate("/people/jobs/new")} aria-label="Create job">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-2 pt-0 sm:p-3 sm:pt-0">
                {jobs.map((job) => {
                  const count = applications.filter((application) => application.jobId === job.id).length;
                  const active = job.id === selectedJob?.id;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => chooseJob(job)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                        active
                          ? "border-blue-300 bg-blue-50 shadow-sm dark:border-blue-800 dark:bg-blue-950/40"
                          : "border-transparent hover:border-border hover:bg-muted/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 font-medium leading-5">{job.title}</span>
                        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground shadow-sm">
                          {count}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{job.department || "No department"}</span>
                        <span aria-hidden>·</span>
                        <span className="capitalize">{job.status}</span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {selectedJob && (
              <Card>
                <CardHeader className="border-b pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">{selectedJob.title}</CardTitle>
                        <Badge variant="outline" className={jobStatusStyle(selectedJob.status)}>
                          {selectedJob.status}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{selectedJob.department}</span>
                        {selectedJob.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {selectedJob.location}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Job actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {selectedJob.status === "open" && (
                          <DropdownMenuItem onClick={() => copyApplyLink(selectedJob)}>
                            <Share2 className="mr-2 h-4 w-4" />
                            Copy application link
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => toggleJobStatus(selectedJob)}
                          disabled={busyAction === `job:${selectedJob.id}`}
                        >
                          {selectedJob.status === "open" ? (
                            <X className="mr-2 h-4 w-4" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          {selectedJob.status === "open" ? "Close job" : "Reopen job"}
                        </DropdownMenuItem>
                        {selectedJob.status === "open" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => window.open(`/apply/${selectedJob.id}`, "_blank", "noopener,noreferrer")}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Preview public page
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {selectedJob.status === "open" && (
                    <Button variant="outline" className="mt-3 w-full gap-2 sm:w-fit" onClick={() => copyApplyLink(selectedJob)}>
                      <Copy className="h-4 w-4" />
                      Copy application link
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
                    <div>
                      <h2 className="font-semibold">Applicants</h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedApplications.length} {selectedApplications.length === 1 ? "person" : "people"}
                      </p>
                    </div>
                  </div>

                  {selectedApplications.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-12 text-center">
                      <Users className="mb-3 h-8 w-8 text-muted-foreground/50" />
                      <p className="font-medium">No applicants yet</p>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Share the application link. New applications will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {selectedApplications.map((application) => {
                        const candidate = application.candidateId
                          ? candidateById.get(application.candidateId)
                          : undefined;
                        const interview = latestInterviewFor(application);
                        const stage = applicantStage(application, candidate, interview);
                        return (
                          <button
                            key={application.id}
                            type="button"
                            onClick={() => setSelectedApplication(application)}
                            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50 sm:px-6"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                              {application.name.trim().charAt(0).toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate font-medium">{application.name}</span>
                                <Badge variant="outline" className={STAGE_STYLE[stage]}>
                                  {STAGE_LABEL[stage]}
                                </Badge>
                              </div>
                              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                {interview && stage === "interview"
                                  ? `${formatDate(interview.interviewDate)} at ${interview.interviewTime}`
                                  : application.email}
                              </p>
                            </div>
                            <span className="hidden shrink-0 text-sm font-medium text-blue-700 sm:block dark:text-blue-300">
                              {renderApplicantAction(application)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selectedApplication} onOpenChange={(open) => !open && setSelectedApplication(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {selectedApplication && selectedStage && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 pr-7">
                  <DialogTitle>{selectedApplication.name}</DialogTitle>
                  <Badge variant="outline" className={STAGE_STYLE[selectedStage]}>
                    {STAGE_LABEL[selectedStage]}
                  </Badge>
                </div>
                <DialogDescription>{selectedApplication.jobTitle}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <a href={`mailto:${selectedApplication.email}`} className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted/50">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{selectedApplication.email}</span>
                  </a>
                  <a href={`tel:${selectedApplication.phone}`} className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted/50">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedApplication.phone}</span>
                  </a>
                </div>

                {selectedApplication.coverNote && (
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Why they applied</Label>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selectedApplication.coverNote}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {selectedApplication.resumePath && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => openResume(selectedApplication)}>
                      <FileText className="h-4 w-4" />
                      Open CV
                    </Button>
                  )}
                  {selectedApplication.linkedInUrl && (
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <a href={selectedApplication.linkedInUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        LinkedIn
                      </a>
                    </Button>
                  )}
                </div>

                {selectedInterview && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                    <div className="flex items-center gap-2 font-medium">
                      <CalendarDays className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                      {formatDate(selectedInterview.interviewDate)} at {selectedInterview.interviewTime}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedInterview.interviewType.replace("_", " ")}
                      {(selectedInterview.location || selectedInterview.meetingLink) &&
                        ` · ${selectedInterview.location || selectedInterview.meetingLink}`}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                {selectedStage !== "hired" && selectedStage !== "rejected" && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setRejectApplication(selectedApplication);
                      setSelectedApplication(null);
                    }}
                  >
                    Not selected
                  </Button>
                )}
                <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
                  {selectedStage === "new" && (
                    <>
                      <Button
                        variant="outline"
                        disabled={busyAction === `shortlist:${selectedApplication.id}`}
                        onClick={() => shortlist(selectedApplication)}
                      >
                        Shortlist
                      </Button>
                      <Button
                        className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                        disabled={busyAction === `schedule:${selectedApplication.id}`}
                        onClick={() => openSchedule(selectedApplication)}
                      >
                        <CalendarDays className="h-4 w-4" />
                        Schedule interview
                      </Button>
                    </>
                  )}
                  {selectedStage === "shortlisted" && (
                    <Button
                      className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                      disabled={busyAction === `schedule:${selectedApplication.id}`}
                      onClick={() => openSchedule(selectedApplication)}
                    >
                      <CalendarDays className="h-4 w-4" />
                      Schedule interview
                    </Button>
                  )}
                  {selectedStage === "interview" && selectedInterview && (
                    <>
                      <Button variant="outline" onClick={() => openSchedule(selectedApplication, selectedInterview)}>
                        Reschedule
                      </Button>
                      <Button
                        className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                        disabled={busyAction === `hire:${selectedApplication.id}`}
                        onClick={() => markReadyToHire(selectedApplication, selectedInterview)}
                      >
                        <Check className="h-4 w-4" />
                        Ready to hire
                      </Button>
                    </>
                  )}
                  {selectedStage === "ready" && canAddEmployee && (
                    <Button
                      className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                      disabled={busyAction === `employee:${selectedApplication.id}`}
                      onClick={() => void startEmployee(selectedApplication)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Add as employee
                    </Button>
                  )}
                  {selectedStage === "ready" && !canAddEmployee && (
                    <p className="max-w-xs text-sm text-muted-foreground">
                      A staff administrator can add this applicant as an employee.
                    </p>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!scheduleApplication} onOpenChange={(open) => !open && setScheduleApplication(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{scheduleInterviewId ? "Reschedule interview" : "Schedule interview"}</DialogTitle>
            <DialogDescription>
              {scheduleApplication?.name} · {scheduleApplication?.jobTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="interview-date">Date</Label>
              <Input
                id="interview-date"
                type="date"
                min={getTodayTL()}
                value={scheduleForm.date}
                onChange={(event) => setScheduleForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interview-time">Time</Label>
              <Input
                id="interview-time"
                type="time"
                value={scheduleForm.time}
                onChange={(event) => setScheduleForm((current) => ({ ...current, time: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={scheduleForm.type}
                onValueChange={(value) => setScheduleForm((current) => ({ ...current, type: value as InterviewType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In person</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="panel">Panel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Length</Label>
              <Select
                value={scheduleForm.duration}
                onValueChange={(value) => setScheduleForm((current) => ({ ...current, duration: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="interview-location">
                {scheduleForm.type === "video" ? "Meeting link" : "Location or instructions"}
              </Label>
              <Input
                id="interview-location"
                value={scheduleForm.location}
                onChange={(event) => setScheduleForm((current) => ({ ...current, location: event.target.value }))}
                placeholder={scheduleForm.type === "video" ? "https://…" : "Office, phone call, or meeting point"}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={scheduleForm.notify}
                onChange={(event) => setScheduleForm((current) => ({ ...current, notify: event.target.checked }))}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Email the interview details to the applicant
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleApplication(null)}>Cancel</Button>
            <Button onClick={saveInterview} disabled={busyAction === "save-interview"} className="bg-blue-600 text-white hover:bg-blue-700">
              {busyAction === "save-interview" ? "Saving…" : "Save interview"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectApplication} onOpenChange={(open) => !open && setRejectApplication(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as not selected?</DialogTitle>
            <DialogDescription>
              {rejectApplication?.name} will receive a short, respectful update. Your reason stays private.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rejection-reason">Private reason</Label>
            <Textarea
              id="rejection-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="For example: another applicant has more relevant experience"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectApplication(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={!rejectReason.trim() || busyAction === "reject"}>
              {busyAction === "reject" ? "Saving…" : "Not selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
