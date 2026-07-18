import {
  CheckCircle2,
  CreditCard,
  MessageCircle,
  ReceiptText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import {
  DEFAULT_PACKAGES_CONFIG,
  calculatePackageEstimate,
  normalizeBillingPackagesConfig,
} from "@/lib/packagePricing";

const DEMO_EMPLOYEES = 10;

function formatMoney(amount: number, locale: "en" | "tet" | "pt"): string {
  const localeTag =
    locale === "pt" ? "pt-PT" : locale === "tet" ? "tet-TL" : "en-US";
  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function PackagePicker() {
  const { t, locale } = useI18n();
  const [pricing, setPricing] = useState(DEFAULT_PACKAGES_CONFIG);

  // Keep the public price in step with the superadmin-controlled billing
  // configuration. Load it after first paint so Firestore is not part of the
  // landing page's critical rendering path; defaults keep the price stable if
  // the network is slow or unavailable.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void Promise.all([
        import("firebase/firestore"),
        import("@/lib/firebase-firestore"),
        import("@/lib/paths"),
      ]).then(async ([{ doc, getDoc }, { db }, { paths }]) => {
        const snapshot = await getDoc(doc(db, paths.packagesConfig()));
        if (!cancelled && snapshot.exists()) {
          setPricing(normalizeBillingPackagesConfig(snapshot.data()));
        }
      }).catch(() => {
        // Published defaults remain visible; checkout always prices server-side.
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const rate = pricing.pricePerEmployee;
  const demoEstimate = calculatePackageEstimate(pricing, { employeeCount: DEMO_EMPLOYEES });
  const minimumEstimate = calculatePackageEstimate(pricing, { employeeCount: 0 });
  const benefits = [
    t("landing.simple.pricing.benefits.payroll"),
    t("landing.simple.pricing.benefits.bankFiles"),
    t("landing.simple.pricing.benefits.people"),
    t("landing.simple.pricing.benefits.ekipa"),
  ];

  return (
    <section
      id="pricing"
      className="lp-defer scroll-mt-16 border-t border-white/[0.06] py-20 lg:py-24"
    >
      <div className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">
            {t("landing.simple.pricing.eyebrow")}
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white lg:text-[2.6rem]">
            {t("landing.simple.pricing.title")}
          </h2>
          <p className="mt-4 text-zinc-400">
            {t("landing.simple.pricing.description")}
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-amber-400/25 bg-amber-400/[0.035]">
          <div className="p-6 text-center sm:p-8 lg:p-10">
            <p className="text-5xl font-extrabold text-white">
              {formatMoney(rate, locale)}
              <span className="mt-2 block text-base font-medium text-zinc-400 sm:ml-2 sm:mt-0 sm:inline">
                {t("landing.simple.pricing.perEmployeeMonth")}
              </span>
            </p>
            <p className="mt-3 text-sm text-zinc-500">
              {t("landing.simple.pricing.example", {
                total: formatMoney(demoEstimate.monthlyTotal, locale),
                employees: DEMO_EMPLOYEES,
              })}
              {" · "}
              {t("landing.simple.pricing.billedMonthly")}
            </p>
            <p className="mt-2 text-sm font-medium text-amber-200">
              {t("landing.simple.pricing.minimum", {
                total: formatMoney(minimumEstimate.monthlyTotal, locale),
                employees: pricing.minimumEmployees,
              })}
              {" · "}
              {t("landing.simple.pricing.annualSaving", {
                total: formatMoney(demoEstimate.annualTotal, locale),
                savings: formatMoney(demoEstimate.annualSavings, locale),
              })}
            </p>

            <Button
              asChild
              className="mt-7 h-11 w-full max-w-xs bg-amber-400 font-bold text-zinc-950 shadow-lg shadow-amber-500/15 hover:bg-amber-300"
            >
              <Link to="/auth/signup">{t("landing.simple.pricing.cta")}</Link>
            </Button>

            <div className="mx-auto mt-8 max-w-2xl border-t border-white/10 pt-7 text-left">
              <p className="mb-4 text-sm font-semibold text-white">
                {t("landing.simple.pricing.includedTitle")}
              </p>
              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-start gap-2.5 text-sm text-zinc-300"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mx-auto mt-7 max-w-xl text-xs leading-5 text-zinc-500">
              {t("landing.simple.pricing.freeNote")}
            </p>
          </div>

          <div className="grid border-t border-white/[0.07] bg-black/20 sm:grid-cols-2 sm:divide-x sm:divide-white/[0.07]">
            <div className="flex gap-3 border-b border-white/[0.07] p-5 text-left sm:border-b-0 sm:p-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/10">
                <CreditCard className="h-4 w-4 text-lime-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {t("landing.simple.pricing.cardPaymentTitle")}
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {t("landing.simple.pricing.cardPaymentDescription")}
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-5 text-left sm:p-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                <ReceiptText className="h-4 w-4 text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {t("landing.simple.pricing.localPaymentTitle")}
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {t("landing.simple.pricing.localPaymentDescription")}
                </p>
                <a
                  href="https://wa.me/6707701234"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {t("landing.simple.pricing.contactSupport")}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
