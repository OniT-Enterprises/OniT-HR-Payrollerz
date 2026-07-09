import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_FEATURES, DEFAULT_PACKAGES_CONFIG } from "@/lib/packagePricing";

const DEMO_EMPLOYEES = 20;

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function PackagePicker() {
  const rate = DEFAULT_PACKAGES_CONFIG.pricePerEmployee;

  return (
    <section id="pricing" className="relative scroll-mt-16 py-24 lg:py-28 border-t border-white/5">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-300">Pricing</p>
          <h2 className="mt-4 text-3xl lg:text-[2.6rem] leading-tight font-extrabold tracking-tight text-white">
            One simple price. Everything included.
          </h2>
          <p className="mt-4 text-zinc-400">
            Start free — set up your whole company, add staff, build a payroll run. You only pay
            when you're ready to run real payroll.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-amber-400/30 bg-amber-400/[0.04] p-8 lg:p-10">
          <div className="flex flex-col items-center text-center">
            <p className="text-5xl font-extrabold text-white">
              {formatMoney(rate)}
              <span className="text-lg font-medium text-zinc-400"> /employee/mo</span>
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              e.g. {formatMoney(rate * DEMO_EMPLOYEES)}/mo for {DEMO_EMPLOYEES} employees · billed monthly
            </p>
            <Button
              asChild
              className="mt-6 w-full max-w-xs font-bold bg-amber-400 text-zinc-950 hover:bg-amber-300 shadow-lg shadow-amber-500/20"
            >
              <Link to="/auth/signup">Start free</Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-x-6 gap-y-3 border-t border-white/10 pt-8 sm:grid-cols-2">
            {ALL_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                <CheckCircle2 className="h-4 w-4 text-lime-400 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-zinc-500">
            Free accounts include every feature. A subscription unlocks finalizing payroll runs.
          </p>
        </div>
      </div>
    </section>
  );
}
