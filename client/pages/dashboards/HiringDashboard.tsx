import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import {
  Users,
  UserPlus,
  Calendar,
  CheckCircle,
  Clock,
  TrendingUp,
  FileText,
  Building,
} from "lucide-react";

export default function HiringDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <UserPlus className="h-8 w-8 text-green-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Hiring Dashboard
                </h1>
                <p className="text-gray-600">
                  Overview of recruitment and hiring activities
                </p>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Open Positions
                    </p>
                    <p className="text-2xl font-bold">12</p>
                    <p className="text-xs text-green-600">+3 this month</p>
                  </div>
                  <Building className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Applications
                    </p>
                    <p className="text-2xl font-bold">247</p>
                    <p className="text-xs text-blue-600">+18 this week</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Interviews Scheduled
                    </p>
                    <p className="text-2xl font-bold">8</p>
                    <p className="text-xs text-orange-600">Next 7 days</p>
                  </div>
                  <Calendar className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Pending Offers
                    </p>
                    <p className="text-2xl font-bold">5</p>
                    <p className="text-xs text-purple-600">Awaiting response</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Hiring Activity</CardTitle>
                <CardDescription>
                  Latest updates in the hiring process
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Sarah Johnson hired</p>
                      <p className="text-xs text-gray-600">
                        Senior Software Engineer position filled
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      Completed
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        3 interviews scheduled
                      </p>
                      <p className="text-xs text-gray-600">
                        Product Manager candidates
                      </p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      Scheduled
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                    <Users className="h-5 w-5 text-orange-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">New job posted</p>
                      <p className="text-xs text-gray-600">
                        Marketing Specialist - Remote
                      </p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">
                      Active
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Application surge</p>
                      <p className="text-xs text-gray-600">
                        UX Designer position - 45 new applications
                      </p>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800">
                      Trending
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hiring Pipeline Status</CardTitle>
                <CardDescription>Current candidates by stage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">
                        Applications Received
                      </p>
                      <p className="text-xs text-gray-600">
                        New candidates to review
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">47</p>
                      <Badge variant="outline">Pending Review</Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Phone Screening</p>
                      <p className="text-xs text-gray-600">
                        Initial interviews scheduled
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">12</p>
                      <Badge className="bg-blue-100 text-blue-800">
                        In Progress
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Technical Interview</p>
                      <p className="text-xs text-gray-600">
                        Skills assessment phase
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">8</p>
                      <Badge className="bg-orange-100 text-orange-800">
                        Scheduled
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Final Interview</p>
                      <p className="text-xs text-gray-600">Decision pending</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">5</p>
                      <Badge className="bg-purple-100 text-purple-800">
                        Final Stage
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
