import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  BarChart3,
  Users,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

interface ModuleDashboardProps {
  moduleName: string;
  moduleIcon: React.ReactNode;
  moduleColor: string;
  stats: Array<{
    title: string;
    value: string;
    change: string;
    changeType: "positive" | "negative" | "neutral";
    icon: React.ReactNode;
  }>;
  quickActions?: Array<{
    label: string;
    icon: React.ReactNode;
    action: () => void;
    variant?: "default" | "outline" | "secondary";
  }>;
  recentItems?: Array<{
    title: string;
    subtitle: string;
    status?: string;
    date?: string;
  }>;
}

export const ModuleDashboard: React.FC<ModuleDashboardProps> = ({
  moduleName,
  moduleIcon,
  moduleColor,
  stats,
  quickActions = [],
  recentItems = [],
}) => {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className={`${moduleColor} p-2 rounded-lg bg-opacity-10`}>
            {moduleIcon}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{moduleName} Dashboard</h1>
            <p className="text-muted-foreground">
              Overview and key metrics for {moduleName.toLowerCase()}
            </p>
          </div>
        </div>

        {quickActions.length > 0 && (
          <div className="flex items-center gap-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || "default"}
                onClick={action.action}
                className="flex items-center gap-2"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className="text-muted-foreground">{stat.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {stat.changeType === "positive" && (
                  <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                )}
                {stat.changeType === "negative" && (
                  <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                )}
                {stat.changeType === "neutral" && (
                  <Minus className="h-3 w-3 text-gray-500 mr-1" />
                )}
                <span
                  className={
                    stat.changeType === "positive"
                      ? "text-green-500"
                      : stat.changeType === "negative"
                        ? "text-red-500"
                        : "text-gray-500"
                  }
                >
                  {stat.change}
                </span>
                <span className="ml-1">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Items */}
      {recentItems.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.subtitle}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.status && (
                        <Badge variant="outline" className="text-xs mb-1">
                          {item.status}
                        </Badge>
                      )}
                      {item.date && (
                        <p className="text-xs text-muted-foreground">
                          {item.date}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Module Activity
                  </span>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Data Status
                  </span>
                  <Badge variant="outline">Up to date</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    System Health
                  </span>
                  <Badge variant="default" className="bg-green-500">
                    Healthy
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
