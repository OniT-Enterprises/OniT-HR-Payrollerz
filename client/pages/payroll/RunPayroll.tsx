import React from "react";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { Calculator } from "lucide-react";

export default function RunPayroll() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <Calculator className="h-8 w-8 text-emerald-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Run Payroll
                </h1>
                <p className="text-gray-600">
                  Process payroll for the current period
                </p>
              </div>
            </div>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-500">
              Payroll processing page coming soon...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
