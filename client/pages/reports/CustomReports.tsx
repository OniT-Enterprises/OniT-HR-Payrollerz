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
import { BarChart3, Download, FileText, TrendingUp } from "lucide-react";

export default function CustomReports() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="h-8 w-8 text-pink-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Custom Reports
                </h1>
                <p className="text-gray-600">
                  Build and customize your own reports
                </p>
              </div>
            </div>
          </div>

          {/* Custom Report Builder */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Report Builder</CardTitle>
                <CardDescription>
                  Create custom reports with filters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Build custom reports with specific fields, filters, and
                  formatting options.
                </p>
                <Button className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Build Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved Reports</CardTitle>
                <CardDescription>
                  Access your saved custom reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  View and regenerate previously saved custom report templates.
                </p>
                <Button className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  View Saved
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>
                  Interactive data visualization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Create interactive dashboards with charts, graphs, and key
                  metrics.
                </p>
                <Button className="w-full">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Create Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
