import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_PACKAGES_CONFIG, calculatePackageEstimate } from "@/lib/packagePricing";

const demoCounts = {
  staffCount: 25,
  adminCount: 2,
};

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function PackagePicker() {
  return (
    <section id="pricing" className="relative py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-emerald-300">Pricing</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-white">Choose the package that fits today</h2>
          <p className="mt-4 text-zinc-400">
            Example monthly estimates use {demoCounts.staffCount} staff and {demoCounts.adminCount} admins.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {DEFAULT_PACKAGES_CONFIG.planDefinitions.map((plan) => {
            const estimate = calculatePackageEstimate(DEFAULT_PACKAGES_CONFIG, {
              planId: plan.id,
              staffCount: demoCounts.staffCount,
              adminCount: demoCounts.adminCount,
            });

            return (
              <div key={plan.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{plan.label}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
                  </div>
                  {plan.staffAppIncluded && <Badge className="bg-emerald-500/20 text-emerald-100">Staff app</Badge>}
                </div>

                <p className="mt-6 text-3xl font-bold text-white">
                  {estimate.monthlyTotal === 0 ? "Free" : formatMoney(estimate.monthlyTotal)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {estimate.monthlyTotal === 0 ? "No monthly cost" : "Estimated monthly total"}
                </p>

                <div className="mt-5 space-y-2">
                  {plan.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-center gap-2 text-sm text-zinc-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>

                <Button asChild className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500">
                  <Link to={`/auth/signup?plan=${plan.id}`}>Start with {plan.label}</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
