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
import { Clock, Download, FileText, TrendingUp } from "lucide-react";

export default function AttendanceReports() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-8 w-8 text-pink-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Attendance Reports
                </h1>
                <p className="text-gray-600">
                  Track and analyze attendance patterns
                </p>
              </div>
            </div>
          </div>

          {/* Available Reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Attendance</CardTitle>
                <CardDescription>Monthly attendance summary</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Detailed monthly attendance report with check-in/out times and
                  totals.
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leave Analysis</CardTitle>
                <CardDescription>
                  Leave patterns and utilization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Analyze leave requests, patterns, and balance utilization
                  across teams.
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overtime Report</CardTitle>
                <CardDescription>Overtime hours tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Track overtime hours, patterns, and costs by employee and
                  department.
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
