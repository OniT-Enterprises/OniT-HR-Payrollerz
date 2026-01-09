import React, { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import {
  UserPlus,
  FileText,
  Shield,
  Monitor,
  GraduationCap,
  Heart,
  Target,
  MessageCircle,
  CheckCircle,
  Upload,
  Calendar,
  Phone,
  CreditCard,
  IdCard,
  Building,
  BookOpen,
  Laptop,
  Award,
} from "lucide-react";

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    address: "",
    mobilePhone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    bankAccountNumber: "",
    taxId: "",
    idDocument: null,
  });
  const [acknowledgements, setAcknowledgements] = useState({
    dressCode: false,
    codeOfConduct: false,
    leavePolicy: false,
    safetyGuidelines: false,
    dataProtection: false,
    signed: false,
    signatureDate: "",
  });
  const [sopStatuses, setSopStatuses] = useState({});

  const steps = [
    { id: 0, label: "Pre-Boarding", icon: <UserPlus className="h-4 w-4" /> },
    {
      id: 1,
      label: "Personal & Legal",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: 2,
      label: "Policies & Acknowledgements",
      icon: <Shield className="h-4 w-4" />,
    },
    { id: 3, label: "Department SOPs", icon: <BookOpen className="h-4 w-4" /> },
    { id: 4, label: "IT & Equipment", icon: <Monitor className="h-4 w-4" /> },
    {
      id: 5,
      label: "Orientation & Training",
      icon: <GraduationCap className="h-4 w-4" />,
    },
    {
      id: 6,
      label: "Benefits Enrollment",
      icon: <Heart className="h-4 w-4" />,
    },
    { id: 7, label: "Probation & Goals", icon: <Target className="h-4 w-4" /> },
    {
      id: 8,
      label: "Feedback & Completion",
      icon: <MessageCircle className="h-4 w-4" />,
    },
  ];

  // Mock SOPs data
  const departmentSOPs = [
    {
      id: 1,
      title: "Code Review Process",
      description: "Guidelines for conducting effective code reviews",
      department: "Engineering",
    },
    {
      id: 2,
      title: "Deployment Procedures",
      description: "Step-by-step deployment and rollback procedures",
      department: "Engineering",
    },
    {
      id: 3,
      title: "Security Best Practices",
      description: "Security protocols and data handling guidelines",
      department: "Engineering",
    },
  ];

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock Firebase save
    console.log("Saving to Firestore:", formData);
    setCurrentStep(2); // Advance to Policies & Acknowledgements
  };

  const handleAcknowledgementsSubmit = () => {
    const hasCheckedItems = Object.values(acknowledgements).some(
      (v) => v === true,
    );
    if (!hasCheckedItems || !acknowledgements.signed) {
      alert("Please acknowledge policies and provide signature");
      return;
    }
    // Mock Firebase save
    console.log("Saving acknowledgements:", acknowledgements);
    setCurrentStep(3); // Advance to Department SOPs
  };

  const handleSOPToggle = (sopId: number) => {
    setSopStatuses((prev) => ({
      ...prev,
      [sopId]: !prev[sopId],
    }));
  };

  const allSOPsCompleted = departmentSOPs.every((sop) => sopStatuses[sop.id]);

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return "completed";
    if (stepId === currentStep) return "current";
    return "upcoming";
  };

  const scrollToSection = (stepId: number) => {
    setCurrentStep(stepId);
    const element = document.getElementById(`step-${stepId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <UserPlus className="h-8 w-8 text-green-400" />
          <div>
            <h1 className="text-3xl font-bold">Employee Onboarding</h1>
            <p className="text-muted-foreground">
              Complete your onboarding process step by step
            </p>
          </div>
        </div>

        {/* Horizontal Stepper */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center">
                  <button
                    onClick={() => scrollToSection(step.id)}
                    className={`flex items-center justify-center w-12 h-12 rounded-full border-2 mb-2 transition-colors ${
                      getStepStatus(step.id) === "completed"
                        ? "bg-green-500 border-green-500 text-white"
                        : getStepStatus(step.id) === "current"
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-muted-foreground text-muted-foreground"
                    }`}
                  >
                    {getStepStatus(step.id) === "completed" ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      step.icon
                    )}
                  </button>
                  <span
                    className={`text-xs text-center font-medium max-w-20 ${
                      getStepStatus(step.id) === "current"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={`absolute w-full h-0.5 top-6 left-1/2 transform -translate-y-1/2 ${
                        getStepStatus(step.id) === "completed"
                          ? "bg-green-500"
                          : "bg-muted"
                      }`}
                      style={{ zIndex: -1 }}
                    />
                  )}
                </div>
              ))}
            </div>
            <Progress
              value={(currentStep / (steps.length - 1)) * 100}
              className="mt-4"
            />
          </CardContent>
        </Card>

        {/* Step Content Sections */}
        <div className="space-y-8">
          {/* Step 0: Pre-Boarding */}
          <section id="step-0" className="py-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-6 w-6" />
                  Pre-Boarding
                </CardTitle>
                <CardDescription>
                  Welcome to the team! Let's get you started with the onboarding
                  process.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Welcome to PayrollHR! We're excited to have you join our
                    team. This onboarding process will help you get familiar
                    with our company policies, procedures, and systems.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">What to Expect</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Complete personal information forms</li>
                        <li>• Review company policies and procedures</li>
                        <li>• Set up IT equipment and accounts</li>
                        <li>• Attend orientation sessions</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Estimated Time</h4>
                      <p className="text-sm text-muted-foreground">
                        The complete onboarding process typically takes 2-3
                        hours spread over your first week.
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => scrollToSection(1)}>
                    Start Onboarding Process
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Step 1: Personal & Legal */}
          <section id="step-1" className="py-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Personal & Legal Information
                </CardTitle>
                <CardDescription>
                  Please provide your personal details and legal documentation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dateOfBirth: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="Enter your full address"
                      required
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mobilePhone">Mobile Phone *</Label>
                      <Input
                        id="mobilePhone"
                        type="tel"
                        value={formData.mobilePhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            mobilePhone: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactName">
                        Emergency Contact Name *
                      </Label>
                      <Input
                        id="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emergencyContactName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactPhone">
                        Emergency Contact Phone *
                      </Label>
                      <Input
                        id="emergencyContactPhone"
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emergencyContactPhone: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankAccountNumber">
                        Bank Account Number *
                      </Label>
                      <Input
                        id="bankAccountNumber"
                        value={formData.bankAccountNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bankAccountNumber: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="taxId">
                        Tax ID / Social Security Number *
                      </Label>
                      <Input
                        id="taxId"
                        value={formData.taxId}
                        onChange={(e) =>
                          setFormData({ ...formData, taxId: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idDocument">ID Document Scan *</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <input
                          type="file"
                          accept=".pdf,.jpg,.png"
                          className="hidden"
                          id="idDocument"
                        />
                        <label htmlFor="idDocument" className="cursor-pointer">
                          <p className="text-sm text-gray-600">
                            Click to upload ID document
                          </p>
                          <p className="text-xs text-gray-400">
                            PDF, JPG, PNG (max 5MB)
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Save & Continue to Policies
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          {/* Step 2: Policies & Acknowledgements */}
          <section id="step-2" className="py-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-6 w-6" />
                  Policies & Acknowledgements
                </CardTitle>
                <CardDescription>
                  Please review our company handbook and acknowledge
                  understanding of our policies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* PDF Viewer Placeholder */}
                <div className="border rounded-lg p-8 bg-gray-50 text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="font-semibold mb-2">Company Handbook</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Employee handbook with company policies, procedures, and
                    guidelines
                  </p>
                  <Button variant="outline">View Full Handbook (PDF)</Button>
                </div>

                {/* Policy Acknowledgements */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Policy Acknowledgements</h4>
                  <div className="space-y-3">
                    {[
                      { id: "dressCode", label: "Dress Code Policy" },
                      { id: "codeOfConduct", label: "Code of Conduct" },
                      { id: "leavePolicy", label: "Leave and Holiday Policy" },
                      { id: "safetyGuidelines", label: "Safety Guidelines" },
                      { id: "dataProtection", label: "Data Protection Policy" },
                    ].map((policy) => (
                      <div
                        key={policy.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={policy.id}
                          checked={acknowledgements[policy.id]}
                          onCheckedChange={(checked) =>
                            setAcknowledgements((prev) => ({
                              ...prev,
                              [policy.id]: checked,
                            }))
                          }
                        />
                        <label
                          htmlFor={policy.id}
                          className="text-sm font-medium"
                        >
                          I have read and understand the {policy.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signature Pad */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Employee Signature</h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                    <p className="text-sm text-muted-foreground mb-4">
                      By checking the box below, I acknowledge that I have read,
                      understood, and agree to comply with all company policies.
                    </p>
                    <div className="flex items-center justify-center space-x-2">
                      <Checkbox
                        id="signature"
                        checked={acknowledgements.signed}
                        onCheckedChange={(checked) =>
                          setAcknowledgements((prev) => ({
                            ...prev,
                            signed: checked,
                            signatureDate: checked
                              ? new Date().toISOString().split("T")[0]
                              : "",
                          }))
                        }
                      />
                      <label htmlFor="signature" className="font-medium">
                        Electronic Signature -{" "}
                        {formData.fullName || "Employee Name"}
                      </label>
                    </div>
                    {acknowledgements.signed && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Signed on: {acknowledgements.signatureDate}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleAcknowledgementsSubmit}
                  className="w-full"
                >
                  Confirm & Next
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Step 3: Department SOPs */}
          <section id="step-3" className="py-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-6 w-6" />
                  Department Standard Operating Procedures
                </CardTitle>
                <CardDescription>
                  Review and acknowledge understanding of department-specific
                  procedures.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {departmentSOPs.map((sop) => (
                    <div key={sop.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{sop.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {sop.description}
                          </p>
                          <Badge variant="outline" className="mt-2">
                            {sop.department}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <Checkbox
                            id={`sop-${sop.id}`}
                            checked={sopStatuses[sop.id] || false}
                            onCheckedChange={() => handleSOPToggle(sop.id)}
                          />
                          <label
                            htmlFor={`sop-${sop.id}`}
                            className="text-sm font-medium"
                          >
                            Mark as Read
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => setCurrentStep(4)}
                  disabled={!allSOPsCompleted}
                  className="w-full"
                >
                  Continue to IT & Equipment
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Placeholder sections for remaining steps */}
          {[4, 5, 6, 7, 8].map((stepId) => (
            <section key={stepId} id={`step-${stepId}`} className="py-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {steps[stepId].icon}
                    {steps[stepId].label}
                  </CardTitle>
                  <CardDescription>
                    {stepId === 4 &&
                      "Set up your IT equipment and system accounts."}
                    {stepId === 5 &&
                      "Complete orientation sessions and training modules."}
                    {stepId === 6 &&
                      "Enroll in company benefits and insurance plans."}
                    {stepId === 7 &&
                      "Set probation period goals and expectations."}
                    {stepId === 8 &&
                      "Provide feedback and complete the onboarding process."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-lg">
                    <div className="mb-4">{steps[stepId].icon}</div>
                    <p className="text-muted-foreground">
                      Content for {steps[stepId].label} will be implemented
                      here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
