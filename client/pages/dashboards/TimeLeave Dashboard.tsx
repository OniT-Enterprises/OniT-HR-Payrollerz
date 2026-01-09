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
  Clock,
  Calendar,
  Users,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  UserCheck,
  Coffee,
} from "lucide-react";

export default function TimeLeaveDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-8 w-8 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Time & Leave Dashboard
                </h1>
                <p className="text-gray-600">
                  Overview of attendance, time tracking, and leave management
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
                      Today's Attendance
                    </p>
                    <p className="text-2xl font-bold">142/156</p>
                    <p className="text-xs text-green-600">
                      91% attendance rate
                    </p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Pending Leave Requests
                    </p>
                    <p className="text-2xl font-bold">12</p>
                    <p className="text-xs text-orange-600">Awaiting approval</p>
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
                      On Leave Today
                    </p>
                    <p className="text-2xl font-bold">8</p>
                    <p className="text-xs text-blue-600">
                      Vacation & sick leave
                    </p>
                  </div>
                  <Coffee className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Overtime Hours
                    </p>
                    <p className="text-2xl font-bold">234</p>
                    <p className="text-xs text-purple-600">This week</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity & Quick Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Time & Leave Activity</CardTitle>
                <CardDescription>
                  Latest attendance and leave updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Leave request approved
                      </p>
                      <p className="text-xs text-gray-600">
                        Sarah Johnson - Vacation leave (5 days)
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      Approved
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Overtime logged</p>
                      <p className="text-xs text-gray-600">
                        Engineering team - 45 hours this week
                      </p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      Overtime
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Late arrivals</p>
                      <p className="text-xs text-gray-600">
                        3 employees arrived late today
                      </p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">
                      Warning
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Attendance trend</p>
                      <p className="text-xs text-gray-600">
                        2% improvement over last month
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
                <CardTitle>Leave Balance Overview</CardTitle>
                <CardDescription>
                  Department-wise leave utilization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Engineering</p>
                      <p className="text-xs text-gray-600">
                        Average leave days used
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">12.5</p>
                      <Badge variant="outline">50% utilized</Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Sales</p>
                      <p className="text-xs text-gray-600">
                        Average leave days used
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">8.2</p>
                      <Badge className="bg-green-100 text-green-800">
                        33% utilized
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Marketing</p>
                      <p className="text-xs text-gray-600">
                        Average leave days used
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">15.8</p>
                      <Badge className="bg-orange-100 text-orange-800">
                        63% utilized
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Operations</p>
                      <p className="text-xs text-gray-600">
                        Average leave days used
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">10.3</p>
                      <Badge className="bg-blue-100 text-blue-800">
                        41% utilized
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
