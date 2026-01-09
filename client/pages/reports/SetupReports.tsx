import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import {
  Settings,
  Download,
  Database,
  Shield,
  Activity,
  FileText,
} from "lucide-react";

export default function SetupReports() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="h-8 w-8 text-pink-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Setup Reports
                </h1>
                <p className="text-gray-600">
                  System configuration and setup analytics
                </p>
              </div>
            </div>
          </div>

          {/* Available Reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>
                  Current system settings and configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Overview of system settings, user permissions, and
                  configuration status.
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Permissions</CardTitle>
                <CardDescription>User roles and access rights</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Audit user roles, permissions, and access levels across the
                  system.
                </p>
                <Button className="w-full">
                  <Shield className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Integration</CardTitle>
                <CardDescription>
                  External system integrations status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Monitor data flows, API connections, and integration health.
                </p>
                <Button className="w-full">
                  <Database className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Activity</CardTitle>
                <CardDescription>
                  Usage patterns and activity logs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Analyze system usage, login patterns, and feature adoption
                  rates.
                </p>
                <Button className="w-full">
                  <Activity className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Report</CardTitle>
                <CardDescription>Regulatory compliance status</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Track compliance with regulations, data policies, and security
                  standards.
                </p>
                <Button className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Backup & Recovery</CardTitle>
                <CardDescription>
                  Data backup and recovery status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Monitor backup schedules, recovery points, and data integrity
                  checks.
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
