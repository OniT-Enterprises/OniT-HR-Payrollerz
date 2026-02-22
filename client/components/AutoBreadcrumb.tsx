/**
 * AutoBreadcrumb Component
 * Automatically generates breadcrumbs from current URL path
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Route segment to readable label mapping
const ROUTE_LABELS: Record<string, string> = {
  // Main sections
  "": "Dashboard",
  "dashboard": "Dashboard",
  "people": "People",
  "payroll": "Payroll",
  "accounting": "Accounting",
  "reports": "Reports",
  "settings": "Settings",
  "admin": "Admin",

  // People sub-routes
  "employees": "Employees",
  "add": "Add Employee",
  "departments": "Departments",
  "org-chart": "Org Chart",
  "jobs": "Jobs",
  "candidates": "Candidates",
  "interviews": "Interviews",
  "onboarding": "Onboarding",
  "offboarding": "Offboarding",
  "time-tracking": "Time Tracking",
  "attendance": "Attendance",
  "leave": "Leave",
  "schedules": "Schedules",
  "goals": "Goals",
  "reviews": "Reviews",
  "training": "Training",
  "disciplinary": "Disciplinary",

  // Payroll sub-routes
  "run": "Run Payroll",
  "history": "History",
  "transfers": "Transfers",
  "taxes": "Taxes",
  "benefits": "Benefits",
  "deductions": "Deductions",

  // Accounting sub-routes
  "chart-of-accounts": "Accounts",
  "journal-entries": "Journal",
  "general-ledger": "Ledger",
  "trial-balance": "Trial Balance",
};

function getLabel(segment: string): string {
  return (
    ROUTE_LABELS[segment] ||
    segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

interface AutoBreadcrumbProps {
  className?: string;
}

function AutoBreadcrumb({ className }: AutoBreadcrumbProps) {
  const location = useLocation();

  const segments = location.pathname.split("/").filter(Boolean);

  // Don't show breadcrumb on dashboard
  if (segments.length === 0 || location.pathname === "/") {
    return null;
  }

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {/* Home */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center">
              <Home className="h-4 w-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />

        {/* Path segments */}
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const path = "/" + segments.slice(0, index + 1).join("/");
          const label = getLabel(segment);

          return (
            <React.Fragment key={path}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={path}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default AutoBreadcrumb;
