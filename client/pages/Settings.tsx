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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { FirebaseIsolationControl } from "@/components/FirebaseIsolationControl";
import { DevAuthControl } from "@/components/DevAuthControl";
import { FetchDiagnostic } from "@/components/FetchDiagnostic";
import { LocalDataStatus } from "@/components/LocalDataStatus";
import { ModeSelector } from "@/components/ModeSelector";
import { getCurrentUser } from "@/lib/localAuth";
import {
  Settings as SettingsIcon,
  User,
  Building,
  Shield,
  Bell,
  Palette,
  Database,
  Download,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Save,
  Camera,
  Key,
  Activity,
} from "lucide-react";

export default function Settings() {
  const user = getCurrentUser();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "Celestino de Freitas",
    email: user?.email || "celestino@company.com",
    phone: "+1 (555) 123-4567",
    department: "Human Resources",
    position: "HR Manager",
    location: "San Francisco, CA",
    joinDate: "January 15, 2023",
    employeeId: "EMP-001",
  });

  const handleSaveProfile = () => {
    setIsEditingProfile(false);
    // Here you would typically save to your backend
    console.log("Profile updated:", profileData);
  };

  const handleProfileInputChange = (field: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const settingsCategories = [
    {
      title: "Account Settings",
      description: "Manage your personal account preferences",
      icon: <User className="h-5 w-5" />,
      items: [
        "Profile Information",
        "Password & Security",
        "Two-Factor Authentication",
        "Session Management",
      ],
    },
    {
      title: "Company Settings",
      description: "Configure company-wide settings and policies",
      icon: <Building className="h-5 w-5" />,
      items: [
        "Company Information",
        "Business Structure",
        "Departments",
        "Holiday Calendar",
      ],
    },
    {
      title: "Access Control",
      description: "Manage user roles and permissions",
      icon: <Shield className="h-5 w-5" />,
      items: ["User Roles", "Permission Levels", "Module Access", "Audit Logs"],
    },
    {
      title: "Notifications",
      description: "Configure alerts and notification preferences",
      icon: <Bell className="h-5 w-5" />,
      items: [
        "Email Notifications",
        "SMS Alerts",
        "System Notifications",
        "Reminder Settings",
      ],
    },
    {
      title: "Appearance",
      description: "Customize the look and feel of the application",
      icon: <Palette className="h-5 w-5" />,
      items: [
        "Theme Settings",
        "Language Preferences",
        "Date & Time Format",
        "Currency Settings",
      ],
    },
    {
      title: "Data Management",
      description: "Backup, export, and manage your data",
      icon: <Database className="h-5 w-5" />,
      items: ["Data Backup", "Data Export", "Data Retention", "Data Privacy"],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold">Settings & Profile</h1>
            <p className="text-muted-foreground">
              Manage your profile and configure application settings
            </p>
          </div>
        </div>

        {/* Profile Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-blue-600 text-white text-xl font-medium">
                      {user
                        ? user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                        : "CDF"}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 h-8 w-8 p-0 rounded-full"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{profileData.name}</h2>
                  <p className="text-muted-foreground">
                    {profileData.position}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{user?.role || "Admin"}</Badge>
                    <Badge variant="secondary">
                      Employee ID: {profileData.employeeId}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                onClick={() =>
                  isEditingProfile
                    ? handleSaveProfile()
                    : setIsEditingProfile(true)
                }
                className="flex items-center gap-2"
              >
                {isEditingProfile ? (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4" />
                    Edit Profile
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    {isEditingProfile ? (
                      <Input
                        id="name"
                        value={profileData.name}
                        onChange={(e) =>
                          handleProfileInputChange("name", e.target.value)
                        }
                      />
                    ) : (
                      <p className="mt-1 text-sm font-medium">
                        {profileData.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label>Email Address</Label>
                      {isEditingProfile ? (
                        <Input
                          value={profileData.email}
                          onChange={(e) =>
                            handleProfileInputChange("email", e.target.value)
                          }
                        />
                      ) : (
                        <p className="text-sm font-medium">
                          {profileData.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label>Phone Number</Label>
                      {isEditingProfile ? (
                        <Input
                          value={profileData.phone}
                          onChange={(e) =>
                            handleProfileInputChange("phone", e.target.value)
                          }
                        />
                      ) : (
                        <p className="text-sm font-medium">
                          {profileData.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label>Location</Label>
                      {isEditingProfile ? (
                        <Input
                          value={profileData.location}
                          onChange={(e) =>
                            handleProfileInputChange("location", e.target.value)
                          }
                        />
                      ) : (
                        <p className="text-sm font-medium">
                          {profileData.location}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Work Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Work Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label>Department</Label>
                      {isEditingProfile ? (
                        <Input
                          value={profileData.department}
                          onChange={(e) =>
                            handleProfileInputChange(
                              "department",
                              e.target.value,
                            )
                          }
                        />
                      ) : (
                        <p className="text-sm font-medium">
                          {profileData.department}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label>Position</Label>
                      {isEditingProfile ? (
                        <Input
                          value={profileData.position}
                          onChange={(e) =>
                            handleProfileInputChange("position", e.target.value)
                          }
                        />
                      ) : (
                        <p className="text-sm font-medium">
                          {profileData.position}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label>Join Date</Label>
                      <p className="text-sm font-medium text-muted-foreground">
                        {profileData.joinDate}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label>Company</Label>
                    <p className="text-sm font-medium text-muted-foreground">
                      {user?.company || "ONIT Technologies"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <Separator className="my-6" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                <Key className="h-5 w-5" />
                <span>Change Password</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                <Shield className="h-5 w-5" />
                <span>Security Settings</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Firebase Emulator Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Firebase Emulator</CardTitle>
            <CardDescription>
              Local development environment for Firestore and Authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocalDataStatus />
          </CardContent>
        </Card>

        {/* Settings Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {settingsCategories.map((category, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {category.icon}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{category.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {category.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {category.items.map((item, itemIndex) => (
                    <div key={itemIndex}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start h-auto p-3 text-left"
                      >
                        <span className="text-sm">{item}</span>
                      </Button>
                      {itemIndex < category.items.length - 1 && (
                        <Separator className="mt-2" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Button className="w-full">Configure {category.title}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Network Fetch Diagnostic */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Network Fetch Diagnostic</CardTitle>
            <CardDescription>
              Fix "Failed to fetch" errors by restoring network functions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FetchDiagnostic />
          </CardContent>
        </Card>

        {/* Development Authentication */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Development Authentication</CardTitle>
            <CardDescription>
              Sign in to Firebase to enable database operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DevAuthControl />
          </CardContent>
        </Card>

        {/* Firebase Database Control */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Firebase Database Control</CardTitle>
            <CardDescription>
              Manage database connectivity and isolation mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FirebaseIsolationControl />
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common settings and administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                <Download className="h-5 w-5" />
                <span>Export All Data</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                <Shield className="h-5 w-5" />
                <span>Security Audit</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex-col gap-2">
                <Database className="h-5 w-5" />
                <span>Backup Now</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
