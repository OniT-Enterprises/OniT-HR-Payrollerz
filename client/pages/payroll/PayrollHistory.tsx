import React from "react";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { FileText } from "lucide-react";

export default function PayrollHistory() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-emerald-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Payroll History
                </h1>
                <p className="text-gray-600">View historical payroll records</p>
              </div>
            </div>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-500">Payroll history page coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
