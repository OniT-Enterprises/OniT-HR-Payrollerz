import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useI18n } from "@/i18n/I18nProvider";
import {
  Calendar,
  Clock,
  Users,
  Mail,
  Phone,
  Search,
  Plus,
  CheckCircle,
  X,
  UserCheck,
  Shield,
  FileText,
  Send,
} from "lucide-react";

export default function Interviews() {
  const [selectedJury, setSelectedJury] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [interviewSchedules, setInterviewSchedules] = useState<{
    [key: number]: { date: string; time: string };
  }>({});
  const { t } = useI18n();

  // Mock data for existing staff (jury members)
  const staff = [
    {
      id: 1,
      name: "John Manager",
      role: "HR Manager",
      department: "HR",
      email: "john.manager@company.com",
    },
    {
      id: 2,
      name: "Sarah Director",
      role: "Engineering Director",
      department: "Engineering",
      email: "sarah.director@company.com",
    },
    {
      id: 3,
      name: "Mike Lead",
      role: "Team Lead",
      department: "Engineering",
      email: "mike.lead@company.com",
    },
    {
      id: 4,
      name: "Lisa Senior",
      role: "Senior Developer",
      department: "Engineering",
      email: "lisa.senior@company.com",
    },
    {
      id: 5,
      name: "Tom Product",
      role: "Product Manager",
      department: "Product",
      email: "tom.product@company.com",
    },
  ];

  // Mock shortlisted candidates
  const shortlistedCandidates = [
    {
      id: 1,
      name: "Sarah Johnson",
      email: "sarah.johnson@email.com",
      phone: "+1 (555) 0123",
      position: "Senior Software Engineer",
      interviewDate: "",
      interviewTime: "",
      criminalRecord: false,
      referencesChecked: false,
      idChecked: false,
      invitationSent: false,
      followUpCall: false,
      status: "Pending Schedule",
    },
    {
      id: 2,
      name: "Michael Chen",
      email: "michael.chen@email.com",
      phone: "+1 (555) 0124",
      position: "Senior Software Engineer",
      interviewDate: "2024-02-15",
      interviewTime: "10:00",
      criminalRecord: true,
      referencesChecked: true,
      idChecked: true,
      invitationSent: true,
      followUpCall: false,
      status: "Scheduled",
    },
  ];

  const handleJurySelection = (staffId: string) => {
    if (selectedJury.includes(staffId)) {
      setSelectedJury(selectedJury.filter((id) => id !== staffId));
    } else {
      setSelectedJury([...selectedJury, staffId]);
    }
  };

  const sendCalendarInvite = (staffId: string) => {
    // Mock function to send calendar invite
    console.log(`Sending calendar invite to staff member ${staffId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Scheduled":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20";
      case "Pending Schedule":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20";
      case "Completed":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "Scheduled":
        return t("hiring.interviews.status.scheduled");
      case "Pending Schedule":
        return t("hiring.interviews.status.pending");
      case "Completed":
        return t("hiring.interviews.status.completed");
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500">
        {/* Decorative orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-400/20 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2" />

        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <AutoBreadcrumb className="mb-6 text-white/70 [&_a]:text-white/70 [&_a:hover]:text-white" />

          <div className="flex items-center gap-4 animate-fade-up">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {t("hiring.interviews.title")}
              </h1>
              <p className="text-emerald-100 mt-1">
                {t("hiring.interviews.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6 animate-fade-up">
          {/* Interview Jury Selection */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                {t("hiring.interviews.jury.title")}
              </CardTitle>
              <CardDescription>
                {t("hiring.interviews.jury.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("hiring.interviews.jury.searchPlaceholder")}
                  className="pl-9"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedJury.includes(member.id.toString())
                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                        : "border-border/50 hover:bg-muted/30"
                    }`}
                    onClick={() => handleJurySelection(member.id.toString())}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{member.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {member.role}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.department}
                        </p>
                      </div>
                      {selectedJury.includes(member.id.toString()) && (
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">
                  {t("hiring.interviews.jury.selectedTitle", {
                    count: selectedJury.length,
                  })}
                </h4>
                {selectedJury.map((juryId) => {
                  const member = staff.find((s) => s.id.toString() === juryId);
                  if (!member) return null;

                  return (
                    <div
                      key={juryId}
                      className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800"
                    >
                      <span className="text-sm font-medium">{member.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendCalendarInvite(juryId)}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          {t("hiring.interviews.jury.invite")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleJurySelection(juryId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Available Dates */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                  <Clock className="h-5 w-5 text-emerald-600" />
                </div>
                {t("hiring.interviews.availability.title")}
              </CardTitle>
              <CardDescription>
                {t("hiring.interviews.availability.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="startDate">
                  {t("hiring.interviews.availability.startDate")}
                </Label>
                <Input id="startDate" type="date" />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="endDate">
                  {t("hiring.interviews.availability.endDate")}
                </Label>
                <Input id="endDate" type="date" />
              </div>

              <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25">
                {t("hiring.interviews.availability.check")}
              </Button>

              <div className="space-y-2">
                <h4 className="font-medium">
                  {t("hiring.interviews.availability.slots")}
                </h4>
                <div className="space-y-1">
                  {[
                    "2024-02-15 10:00-11:00",
                    "2024-02-15 14:00-15:00",
                    "2024-02-16 09:00-10:00",
                  ].map((slot, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="text-sm">{slot}</span>
                      <Checkbox />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interview Settings */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                {t("hiring.interviews.settings.title")}
              </CardTitle>
              <CardDescription>
                {t("hiring.interviews.settings.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="duration">
                  {t("hiring.interviews.settings.duration")}
                </Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("hiring.interviews.settings.durationPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">
                      {t("hiring.interviews.settings.durationOptions.minutes30")}
                    </SelectItem>
                    <SelectItem value="45">
                      {t("hiring.interviews.settings.durationOptions.minutes45")}
                    </SelectItem>
                    <SelectItem value="60">
                      {t("hiring.interviews.settings.durationOptions.hour1")}
                    </SelectItem>
                    <SelectItem value="90">
                      {t("hiring.interviews.settings.durationOptions.hour1_5")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">
                  {t("hiring.interviews.settings.location")}
                </Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("hiring.interviews.settings.locationPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conference-room-a">
                      {t("hiring.interviews.settings.locationOptions.roomA")}
                    </SelectItem>
                    <SelectItem value="conference-room-b">
                      {t("hiring.interviews.settings.locationOptions.roomB")}
                    </SelectItem>
                    <SelectItem value="virtual">
                      {t("hiring.interviews.settings.locationOptions.virtual")}
                    </SelectItem>
                    <SelectItem value="phone">
                      {t("hiring.interviews.settings.locationOptions.phone")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">
                  {t("hiring.interviews.settings.notes")}
                </Label>
                <Textarea
                  id="notes"
                  placeholder={t("hiring.interviews.settings.notesPlaceholder")}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shortlisted Candidates */}
        <Card className="mt-6 border-border/50 animate-fade-up stagger-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              {t("hiring.interviews.candidates.title")}
            </CardTitle>
            <CardDescription>
              {t("hiring.interviews.candidates.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">
                      {t("hiring.interviews.table.candidate")}
                    </th>
                    <th className="text-center p-3 font-medium">
                      {t("hiring.interviews.table.date")}
                    </th>
                    <th className="text-center p-3 font-medium">
                      {t("hiring.interviews.table.time")}
                    </th>
                    <th className="text-center p-3 font-medium">
                      {t("hiring.interviews.table.preChecks")}
                    </th>
                    <th className="text-center p-3 font-medium">
                      {t("hiring.interviews.table.communication")}
                    </th>
                    <th className="text-center p-3 font-medium">
                      {t("hiring.interviews.table.status")}
                    </th>
                    <th className="text-center p-3 font-medium">
                      {t("hiring.interviews.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shortlistedCandidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className="border-b hover:bg-muted/50"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {candidate.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold">{candidate.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {candidate.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {candidate.phone}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <Input
                          type="date"
                          value={
                            interviewSchedules[candidate.id]?.date ||
                            candidate.interviewDate
                          }
                          onChange={(e) =>
                            setInterviewSchedules((prev) => ({
                              ...prev,
                              [candidate.id]: {
                                ...prev[candidate.id],
                                date: e.target.value,
                                time:
                                  prev[candidate.id]?.time ||
                                  candidate.interviewTime,
                              },
                            }))
                          }
                          className="w-32 mx-auto"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <Input
                          type="time"
                          value={
                            interviewSchedules[candidate.id]?.time ||
                            candidate.interviewTime
                          }
                          onChange={(e) =>
                            setInterviewSchedules((prev) => ({
                              ...prev,
                              [candidate.id]: {
                                ...prev[candidate.id],
                                time: e.target.value,
                                date:
                                  prev[candidate.id]?.date ||
                                  candidate.interviewDate,
                              },
                            }))
                          }
                          className="w-24 mx-auto"
                        />
                      </td>

                      <td className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={candidate.criminalRecord}
                              id={`criminal-${candidate.id}`}
                            />
                            <label
                              htmlFor={`criminal-${candidate.id}`}
                              className="text-sm"
                            >
                              {t("hiring.interviews.checks.criminalRecord")}
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={candidate.referencesChecked}
                              id={`references-${candidate.id}`}
                            />
                            <label
                              htmlFor={`references-${candidate.id}`}
                              className="text-sm"
                            >
                              {t("hiring.interviews.checks.references")}
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={candidate.idChecked}
                              id={`id-${candidate.id}`}
                            />
                            <label
                              htmlFor={`id-${candidate.id}`}
                              className="text-sm"
                            >
                              {t("hiring.interviews.checks.idVerified")}
                            </label>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={candidate.invitationSent}
                              id={`invitation-${candidate.id}`}
                            />
                            <label
                              htmlFor={`invitation-${candidate.id}`}
                              className="text-sm"
                            >
                              {t("hiring.interviews.communication.inviteSent")}
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={candidate.followUpCall}
                              id={`followup-${candidate.id}`}
                            />
                            <label
                              htmlFor={`followup-${candidate.id}`}
                              className="text-sm"
                            >
                              {t("hiring.interviews.communication.followUp")}
                            </label>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <Badge className={getStatusColor(candidate.status)}>
                          {getStatusLabel(candidate.status)}
                        </Badge>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <Button size="sm" variant="outline">
                            <Mail className="h-3 w-3 mr-1" />
                            {t("hiring.interviews.actions.sendInvite")}
                          </Button>
                          <Button size="sm" variant="outline">
                            <Phone className="h-3 w-3 mr-1" />
                            {t("hiring.interviews.actions.call")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
