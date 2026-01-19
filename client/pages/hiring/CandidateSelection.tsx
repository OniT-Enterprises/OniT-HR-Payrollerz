import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { candidateService, type Candidate } from "@/services/candidateService";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenantId } from "@/contexts/TenantContext";
import { SEO, seoConfig } from "@/components/SEO";
import {
  Users,
  Search,
  Filter,
  Download,
  Mail,
  Phone,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Upload,
  File,
  ChevronDown,
} from "lucide-react";

export default function CandidateSelection() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importedData, setImportedData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState({
    cv: null as File | null,
    coverLetter: null as File | null,
  });

  // Sample realistic candidate data for AI extraction
  const sampleCandidates = [
    {
      name: "Alexandra Chen",
      email: "alexandra.chen@gmail.com",
      phone: "+1 (555) 0891",
    },
    {
      name: "Marcus Rodriguez",
      email: "m.rodriguez@outlook.com",
      phone: "+1 (555) 0742",
    },
    {
      name: "Priya Patel",
      email: "priya.patel.dev@gmail.com",
      phone: "+1 (555) 0963",
    },
    {
      name: "James Wilson",
      email: "james.wilson2024@email.com",
      phone: "+1 (555) 0854",
    },
    {
      name: "Sofia Andersson",
      email: "sofia.andersson@proton.me",
      phone: "+1 (555) 0721",
    },
    {
      name: "David Kim",
      email: "dkim.engineer@gmail.com",
      phone: "+1 (555) 0638",
    },
    {
      name: "Isabella Martinez",
      email: "isabella.martinez.dev@outlook.com",
      phone: "+1 (555) 0917",
    },
    {
      name: "Ryan O'Connor",
      email: "ryan.oconnor.tech@gmail.com",
      phone: "+1 (555) 0582",
    },
  ];

  // State for managing candidates list
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();

  // Load candidates from Firebase on component mount
  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const candidatesData = await candidateService.getAllCandidates(tenantId);
      setCandidates(candidatesData);
    } catch (error) {
      console.error("Error loading candidates:", error);
      toast({
        title: t("addEmployee.toast.errorTitle"),
        description: t("hiring.candidates.toast.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // AI extraction function - simulates real AI processing with realistic data
  const extractInfoFromFiles = async (
    cvFile?: File,
    coverLetterFile?: File,
  ) => {
    setIsProcessing(true);

    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get a random candidate from sample data to simulate AI extraction
    const randomCandidate =
      sampleCandidates[Math.floor(Math.random() * sampleCandidates.length)];

    setImportedData(randomCandidate);
    setIsProcessing(false);
  };

  const handleCVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const cvFile = files[0];
      setUploadedFiles((prev) => ({ ...prev, cv: cvFile }));
      // Trigger AI extraction when CV is uploaded
      extractInfoFromFiles(cvFile, uploadedFiles.coverLetter);
    }
  };

  const handleCoverLetterUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const coverLetterFile = files[0];
      setUploadedFiles((prev) => ({ ...prev, coverLetter: coverLetterFile }));
      // Trigger AI extraction when cover letter is uploaded
      extractInfoFromFiles(uploadedFiles.cv, coverLetterFile);
    }
  };

  // Function to add new candidate to the list
  const addCandidate = async () => {
    if (!importedData.name) return;

    try {
      const newCandidate: Omit<Candidate, "id"> = {
        tenantId,
        name: importedData.name,
        email: importedData.email,
        phone: importedData.phone,
        position: "Senior Software Engineer", // Default position
        experience: "TBD", // To be determined
        score: 0,
        status: "New",
        appliedDate: new Date().toISOString().split("T")[0],
        resume: uploadedFiles.cv?.name || "uploaded_resume.pdf",
        avatar: importedData.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase(),
        cvQuality: Math.floor(Math.random() * 3) + 7, // Random score 7-9
        coverLetter: Math.floor(Math.random() * 3) + 7, // Random score 7-9
        technicalSkills: Math.floor(Math.random() * 3) + 7, // Random score 7-9
        interviewScore: null,
        totalScore: Math.floor(Math.random() * 2) + 7.5, // Random score 7.5-8.5
      };

      const candidateId = await candidateService.addCandidate(tenantId, newCandidate);

      if (candidateId) {
        toast({
          title: t("addEmployee.toast.addedTitle"),
          description: t("hiring.candidates.toast.addSuccess"),
        });
        // Reload candidates to get the updated list
        await loadCandidates();
      } else {
        throw new Error("Failed to add candidate");
      }
    } catch (error) {
      console.error("Error adding candidate:", error);
      toast({
        title: t("addEmployee.toast.errorTitle"),
        description: t("hiring.candidates.toast.addFailed"),
        variant: "destructive",
      });
    } finally {
      // Reset dialog state
      setShowImportDialog(false);
      setUploadedFiles({ cv: null, coverLetter: null });
      setImportedData({ name: "", email: "", phone: "" });
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Shortlisted":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20";
      case "Under Review":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20";
      case "New":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20";
      case "Rejected":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "Shortlisted":
        return t("hiring.candidates.statusLabels.shortlisted");
      case "Under Review":
        return t("hiring.candidates.statusLabels.underReview");
      case "New":
        return t("hiring.candidates.statusLabels.new");
      case "Rejected":
        return t("hiring.candidates.statusLabels.rejected");
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Shortlisted":
        return <CheckCircle className="h-4 w-4" />;
      case "Under Review":
        return <Clock className="h-4 w-4" />;
      case "New":
        return <Star className="h-4 w-4" />;
      case "Rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 8.5) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 7.5) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.candidates} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-emerald-50 dark:bg-emerald-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("hiring.candidates.title")}</h1>
              <p className="text-muted-foreground mt-1">
                {t("hiring.candidates.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-up">
          <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("hiring.candidates.stats.totalApplications")}
                  </p>
                  <p className="text-2xl font-bold">{candidates.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
                  <Users className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("hiring.candidates.stats.shortlisted")}
                  </p>
                  <p className="text-2xl font-bold">
                    {
                      candidates.filter((c) => c.status === "Shortlisted")
                        .length
                    }
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("hiring.candidates.stats.underReview")}
                  </p>
                  <p className="text-2xl font-bold">
                    {
                      candidates.filter((c) => c.status === "Under Review")
                        .length
                    }
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("hiring.candidates.stats.newApplications")}
                  </p>
                  <p className="text-2xl font-bold">
                    {candidates.filter((c) => c.status === "New").length}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg">
                  <Star className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls row - job selector inline with other buttons */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("hiring.candidates.controls.searchPlaceholder")}
                className="pl-9 w-64"
              />
            </div>
            <Button size="sm">{t("hiring.candidates.controls.search")}</Button>
          </div>

          <div className="flex items-center gap-3">
            <select className="px-4 py-2 border rounded-md bg-background min-w-[200px] h-9">
              <option value="">
                {t("hiring.candidates.controls.selectPosition")}
              </option>
              <option value="senior-software-engineer">
                {t("hiring.candidates.positions.seniorSoftwareEngineer")}
              </option>
              <option value="marketing-manager">
                {t("hiring.candidates.positions.marketingManager")}
              </option>
              <option value="hr-specialist">
                {t("hiring.candidates.positions.hrSpecialist")}
              </option>
              <option value="data-analyst">
                {t("hiring.candidates.positions.dataAnalyst")}
              </option>
              <option value="product-manager">
                {t("hiring.candidates.positions.productManager")}
              </option>
            </select>

            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  {t("hiring.candidates.controls.importApplication")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {t("hiring.candidates.import.title")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("hiring.candidates.import.description")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {t("hiring.candidates.import.cvLabel")}
                      </label>
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          uploadedFiles.cv
                            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                            : "border-border"
                        }`}
                      >
                        <File
                          className={`h-8 w-8 mx-auto mb-2 ${
                            uploadedFiles.cv
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }`}
                        />
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleCVUpload}
                          className="hidden"
                          id="cv-upload"
                        />
                        <label htmlFor="cv-upload" className="cursor-pointer">
                          <p className="text-sm text-muted-foreground">
                            {uploadedFiles.cv
                              ? uploadedFiles.cv.name
                              : t("hiring.candidates.import.clickUploadCv")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("hiring.candidates.import.fileTypes")}
                          </p>
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {t("hiring.candidates.import.coverLabel")}
                      </label>
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          uploadedFiles.coverLetter
                            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                            : "border-border"
                        }`}
                      >
                        <Mail
                          className={`h-8 w-8 mx-auto mb-2 ${
                            uploadedFiles.coverLetter
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }`}
                        />
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleCoverLetterUpload}
                          className="hidden"
                          id="cl-upload"
                        />
                        <label htmlFor="cl-upload" className="cursor-pointer">
                          <p className="text-sm text-muted-foreground">
                            {uploadedFiles.coverLetter
                              ? uploadedFiles.coverLetter.name
                              : t("hiring.candidates.import.clickUploadCover")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("hiring.candidates.import.fileTypes")}
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>

                  {isProcessing && (
                    <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50 dark:bg-blue-950/30">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400"></div>
                        <div>
                          <h4 className="font-medium text-blue-800 dark:text-blue-300">
                            {t("hiring.candidates.import.processingTitle")}
                          </h4>
                          <p className="text-sm text-blue-600 dark:text-blue-400">
                            {t("hiring.candidates.import.processingDesc")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isProcessing && importedData.name && (
                    <div className="border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 bg-emerald-50 dark:bg-emerald-950/30">
                      <h4 className="font-medium mb-3 text-emerald-800 dark:text-emerald-300">
                        {t("hiring.candidates.import.extractedTitle")}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">
                            {t("hiring.candidates.import.fields.name")}
                          </label>
                          <p className="font-medium">{importedData.name}</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            {t("hiring.candidates.import.fields.email")}
                          </label>
                          <p className="font-medium">{importedData.email}</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            {t("hiring.candidates.import.fields.phone")}
                          </label>
                          <p className="font-medium">{importedData.phone}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowImportDialog(false);
                        setUploadedFiles({ cv: null, coverLetter: null });
                        setImportedData({ name: "", email: "", phone: "" });
                        setIsProcessing(false);
                      }}
                    >
                      {t("hiring.candidates.import.cancel")}
                    </Button>
                    <Button
                      disabled={!importedData.name || isProcessing}
                      onClick={addCandidate}
                    >
                      {isProcessing
                        ? t("hiring.candidates.import.processing")
                        : t("hiring.candidates.import.addCandidate")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              {t("hiring.candidates.controls.export")}
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              {t("hiring.candidates.controls.filter")}
            </Button>
          </div>
        </div>

        {/* Candidates List */}
        <Card className="border-border/50 animate-fade-up stagger-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              {t("hiring.candidates.list.title")}
            </CardTitle>
            <CardDescription>
              {t("hiring.candidates.list.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-48 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-8 w-16" />
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">
                        {t("hiring.candidates.table.candidate")}
                      </th>
                      <th className="text-center p-3 font-medium">
                        <button className="flex flex-col items-center gap-1 hover:bg-muted/30 p-1 rounded">
                          <span className="text-xs leading-tight">
                            {t("hiring.candidates.table.cv")}
                          </span>
                          <span className="text-xs leading-tight">
                            {t("hiring.candidates.table.quality")}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-center p-3 font-medium">
                        <button className="flex flex-col items-center gap-1 hover:bg-muted/30 p-1 rounded">
                          <span className="text-xs leading-tight">
                            {t("hiring.candidates.table.cover")}
                          </span>
                          <span className="text-xs leading-tight">
                            {t("hiring.candidates.table.letter")}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-center p-3 font-medium">
                        <button className="flex flex-col items-center gap-1 hover:bg-muted/30 p-1 rounded">
                          <span className="text-xs leading-tight ml-2.5">
                            {t("hiring.candidates.table.technical")}
                          </span>
                          <span className="text-xs leading-tight ml-2.5">
                            {t("hiring.candidates.table.skills")}
                          </span>
                          <ChevronDown className="h-3 w-3 ml-2.5" />
                        </button>
                      </th>
                      <th className="text-center p-3 font-medium">
                        <button className="flex flex-col items-center gap-1 hover:bg-muted/30 p-1 rounded ml-3.5">
                          <span className="text-xs leading-tight">
                            {t("hiring.candidates.table.interview")}
                          </span>
                          <span className="text-xs leading-tight">
                            {t("hiring.candidates.table.score")}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-center p-3 font-medium">
                        <button className="flex flex-col items-center gap-1 hover:bg-muted/30 p-1 rounded">
                          <span className="text-sm font-semibold leading-tight ml-2.5">
                            {t("hiring.candidates.table.total")}
                          </span>
                          <span className="text-sm font-semibold leading-tight ml-2.5">
                            {t("hiring.candidates.table.score")}
                          </span>
                          <ChevronDown className="h-3 w-3 ml-2.5" />
                        </button>
                      </th>
                      <th className="text-center p-3 font-medium">
                        {t("hiring.candidates.table.status")}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {t("hiring.candidates.table.documents")}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {t("hiring.candidates.table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate) => (
                      <tr
                        key={candidate.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        {/* Candidate Info */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage
                                src={`/placeholder.svg`}
                                alt={candidate.name}
                              />
                              <AvatarFallback>
                                {candidate.avatar}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold">
                                {candidate.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {candidate.email}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline">
                                  {candidate.experience}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {t("hiring.candidates.appliedLabel", {
                                    date: candidate.appliedDate,
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* CV Quality */}
                        <td className="p-3 text-center">
                          <span
                            className={`font-semibold ${getScoreColor(candidate.cvQuality)}`}
                          >
                            {candidate.cvQuality}/10
                          </span>
                        </td>

                        {/* Cover Letter */}
                        <td className="p-3 text-center">
                          <span
                            className={`font-semibold ${getScoreColor(candidate.coverLetter)}`}
                          >
                            {candidate.coverLetter}/10
                          </span>
                        </td>

                        {/* Technical Skills */}
                        <td className="p-3 text-center">
                          <span
                            className={`font-semibold ${getScoreColor(candidate.technicalSkills)}`}
                          >
                            {candidate.technicalSkills}/10
                          </span>
                        </td>

                        {/* Interview Score */}
                        <td className="p-3 text-center">
                          {candidate.interviewScore ? (
                            <span
                              className={`font-semibold ${getScoreColor(candidate.interviewScore)}`}
                            >
                              {candidate.interviewScore}/10
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-semibold">
                              {t("hiring.candidates.na")}
                            </span>
                          )}
                        </td>

                        {/* Total Score */}
                        <td className="p-3 text-center">
                          <span
                            className={`font-bold text-lg ${getScoreColor(candidate.totalScore)}`}
                          >
                            {candidate.totalScore}/10
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {getStatusIcon(candidate.status)}
                            <Badge className={getStatusColor(candidate.status)}>
                              {getStatusLabel(candidate.status)}
                            </Badge>
                          </div>
                        </td>

                        {/* Documents */}
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-3">
                            {/* CV and CL stacked */}
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium">
                                  {t("hiring.candidates.documents.cv")}
                                </span>
                                <span className="text-xs font-medium">
                                  {t("hiring.candidates.documents.cl")}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                {/* CV Viewer */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 p-0 rounded-full border"
                                    >
                                      <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                        <File className="h-2 w-2 text-primary-foreground" />
                                      </div>
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl max-h-[80vh]">
                                    <DialogHeader>
                                      <DialogTitle>
                                        {t("hiring.candidates.documents.cvTitle", {
                                          name: candidate.name,
                                        })}
                                      </DialogTitle>
                                      <DialogDescription>
                                        {t("hiring.candidates.documents.cvDesc")}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="border rounded-lg p-4 h-[60vh] overflow-auto bg-muted/30">
                                      <div className="text-center text-muted-foreground">
                                        <File className="h-16 w-16 mx-auto mb-4" />
                                        <p>
                                          {t(
                                            "hiring.candidates.documents.cvPlaceholder",
                                          )}
                                        </p>
                                        <p className="text-sm">
                                          {candidate.resume}
                                        </p>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                {/* Cover Letter Viewer */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 p-0 rounded-sm border"
                                    >
                                      <div className="h-4 w-4 bg-secondary flex items-center justify-center rounded-sm">
                                        <div className="h-2 w-3 bg-foreground rounded-sm opacity-70"></div>
                                      </div>
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl max-h-[80vh]">
                                    <DialogHeader>
                                      <DialogTitle>
                                        {t(
                                          "hiring.candidates.documents.coverTitle",
                                          { name: candidate.name },
                                        )}
                                      </DialogTitle>
                                      <DialogDescription>
                                        {t(
                                          "hiring.candidates.documents.coverDesc",
                                        )}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="border rounded-lg p-4 h-[60vh] overflow-auto bg-muted/30">
                                      <div className="text-center text-muted-foreground">
                                        <Mail className="h-16 w-16 mx-auto mb-4" />
                                        <p>
                                          {t(
                                            "hiring.candidates.documents.coverPlaceholder",
                                          )}
                                        </p>
                                        <p className="text-sm">
                                          {t(
                                            "hiring.candidates.documents.coverContent",
                                            { name: candidate.name },
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </div>

                            {/* Contact icons stacked */}
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0"
                              >
                                <Phone className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0"
                              >
                                <Mail className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-3">
                          <div className="flex flex-col items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-20"
                            >
                              {t("hiring.candidates.actions.reject")}
                            </Button>
                            <Button size="sm" className="w-20">
                              {t("hiring.candidates.actions.shortlist")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
