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
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
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
        return "bg-green-100 text-green-800";
      case "Pending Schedule":
        return "bg-yellow-100 text-yellow-800";
      case "Completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <Calendar className="h-8 w-8 text-green-400" />
          <div>
            <h1 className="text-3xl font-bold">Interviews</h1>
            <p className="text-muted-foreground">
              Manage interview scheduling and jury selection
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Interview Jury Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Interview Jury Selection
              </CardTitle>
              <CardDescription>
                Select staff members to serve on the interview panel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search staff members..." className="pl-9" />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedJury.includes(member.id.toString())
                        ? "bg-green-50 border-green-200"
                        : "hover:bg-gray-50"
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
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">
                  Selected Jury Members ({selectedJury.length})
                </h4>
                {selectedJury.map((juryId) => {
                  const member = staff.find((s) => s.id.toString() === juryId);
                  if (!member) return null;

                  return (
                    <div
                      key={juryId}
                      className="flex items-center justify-between p-2 bg-green-50 rounded"
                    >
                      <span className="text-sm font-medium">{member.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendCalendarInvite(juryId)}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Invite
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Available Dates
              </CardTitle>
              <CardDescription>
                Check available dates that all jury members agree to
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" />
              </div>

              <Button className="w-full">Check Availability</Button>

              <div className="space-y-2">
                <h4 className="font-medium">Available Slots</h4>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Interview Settings
              </CardTitle>
              <CardDescription>
                Configure interview parameters and requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Interview Duration</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Interview Location</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conference-room-a">
                      Conference Room A
                    </SelectItem>
                    <SelectItem value="conference-room-b">
                      Conference Room B
                    </SelectItem>
                    <SelectItem value="virtual">
                      Virtual (Zoom/Teams)
                    </SelectItem>
                    <SelectItem value="phone">Phone Interview</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Interview Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Special instructions, technical requirements, etc."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shortlisted Candidates */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Shortlisted Candidates</CardTitle>
            <CardDescription>
              Manage interview scheduling and pre-interview checks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Candidate</th>
                    <th className="text-center p-3 font-medium">
                      Interview Date
                    </th>
                    <th className="text-center p-3 font-medium">
                      Interview Time
                    </th>
                    <th className="text-center p-3 font-medium">
                      Pre-Interview Checks
                    </th>
                    <th className="text-center p-3 font-medium">
                      Communication
                    </th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">Actions</th>
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
                              Criminal Record
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
                              References Checked
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
                              ID Verified
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
                              Invitation Sent
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
                              Follow-up Call
                            </label>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <Badge className={getStatusColor(candidate.status)}>
                          {candidate.status}
                        </Badge>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <Button size="sm" variant="outline">
                            <Mail className="h-3 w-3 mr-1" />
                            Send Invite
                          </Button>
                          <Button size="sm" variant="outline">
                            <Phone className="h-3 w-3 mr-1" />
                            Call
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
