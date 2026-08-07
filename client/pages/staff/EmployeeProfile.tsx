/**
 * Employee profile — the read-only twin of the Add/Edit Employee form.
 *
 * This replaces a `max-w-4xl` dialog that put a three-column card grid inside a
 * modal. Two reasons it is a page now:
 *
 *  - On a phone the modal was the worst surface for the densest screen in the
 *    product, and it could not be linked to, bookmarked, or reached with Back.
 *  - Viewing and editing showed the same facts in a DIFFERENT order under
 *    DIFFERENT labels. Mirroring the form's section order means you learn the
 *    shape once.
 *
 * Field labels are the form's own `addEmployee.*` keys, so every label here is
 * already translated in en/pt/tet — the dialog this replaces was entirely
 * hardcoded English.
 *
 * "Read-only" means no field editing. It does NOT mean inert: the compliance
 * banner, the Art. 12/13 fixed-term conversion, the Ekipa app invite and the
 * CV export are all actions on the record as a whole, and all survive.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  FileText,
  Flag,
  Globe,
  Pencil,
  Send,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SEO } from "@/components/SEO";
import { useToast } from "@/hooks/use-toast";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { employeeService } from "@/services/employeeService";
import { employeeKeys, useAllEmployees } from "@/hooks/useEmployees";
import { useLeaveBalance } from "@/hooks/useLeaveRequests";
import { formatDateTL } from "@/lib/dateUtils";
import { getComplianceIssues } from "@/lib/employeeUtils";
import {
  hasExceededFixedTermLimit,
  contractSpanExceedsFixedTermLimit,
} from "@/lib/probation";
import { NATIONALITY_FLAGS } from "@/lib/constants";

// ── helpers ────────────────────────────────────────────────────────

function formatSalary(monthlySalary: number): string {
  return `$${(monthlySalary || 0).toLocaleString()}`;
}

/** Days until `date`; negative when already past. */
function daysUntil(date: string): number | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export default function EmployeeProfile() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { canManage } = useTenant();
  const canManageTenant = canManage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useAllEmployees();
  const employee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const managerName = useMemo(() => {
    const mgr = employee?.jobDetails?.manager;
    if (!mgr) return null;
    const found = employees.find(
      (e) => e.jobDetails?.employeeId === mgr || e.id === mgr,
    );
    return found
      ? `${found.personalInfo.firstName} ${found.personalInfo.lastName}`
      : mgr;
  }, [employee, employees]);

  const issues = useMemo(
    () => (employee ? getComplianceIssues([employee]) : []),
    [employee],
  );
  const { data: leaveBalance } = useLeaveBalance(employee?.id);

  const [inviting, setInviting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState(false);

  // The form's labels carry a required marker ("First Name *"). It means
  // nothing on a view, so strip it rather than duplicate 40 strings.
  const label = (key: string) => t(key).replace(/\s*\*\s*$/, "");
  const notProvided = t("employees.profile.notProvided");

  const editHref = `/people/add?edit=${employeeId}`;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <Skeleton className="mb-2 h-4 w-28" />
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <div className="space-y-8">
          {[0, 1, 2].map((section) => (
            <div key={section} className="space-y-4">
              <Skeleton className="h-5 w-40" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((field) => (
                  <div key={field} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-36" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <BackLink t={t} />
        <p className="mt-6 text-sm text-muted-foreground">
          {t("employees.profile.notFound")}
        </p>
      </div>
    );
  }

  const p = employee.personalInfo;
  const j = employee.jobDetails;
  const c = employee.compensation;
  const d = employee.documents;
  const fullName = `${p.firstName} ${p.lastName}`.trim();

  const handleAppInvite = async () => {
    const email = p.email?.trim();
    if (!canManageTenant || !email || !employee.id) return;
    setInviting(true);
    try {
      await employeeService.sendAppInvite(tenantId, {
        email,
        employeeDocId: employee.id,
      });
      toast({
        title: t("employees.profile.inviteSentTitle"),
        description: t("employees.profile.inviteSentDesc", { email }),
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "functions/already-exists") {
        toast({
          title: t("employees.profile.inviteExistsTitle"),
          description: t("employees.profile.inviteExistsDesc", { email }),
        });
      } else {
        console.error("App invite failed:", error);
        toast({
          title: t("employees.profile.inviteFailedTitle"),
          description:
            error instanceof Error ? error.message : t("employees.profile.unknownError"),
          variant: "destructive",
        });
      }
    } finally {
      setInviting(false);
    }
  };

  // Art. 12(4)/13: renewals cannot take a fixed-term contract past 3 years.
  const isFixedTerm =
    !!j.contractEndDate || /fixed|contract|temp/i.test(j.employmentType || "");
  const elapsedOverLimit = hasExceededFixedTermLimit(j.hireDate);
  const spanOverLimit = contractSpanExceedsFixedTermLimit(
    j.hireDate,
    j.contractEndDate,
  );
  const showFixedTermWarning =
    canManageTenant &&
    isFixedTerm &&
    !converted &&
    (elapsedOverLimit || spanOverLimit);

  const handleConvert = async () => {
    if (!employee.id) return;
    setConverting(true);
    try {
      await employeeService.updateEmployee(tenantId, employee.id, {
        jobDetails: {
          ...j,
          // "Permanent" = full-time with no contract end date.
          employmentType: "Full-time",
          contractEndDate: "",
        },
      });
      await queryClient.invalidateQueries({
        queryKey: employeeKeys.all(tenantId),
      });
      setConverted(true);
      toast({
        title: t("employees.profile.convertedTitle"),
        description: t("employees.profile.convertedDesc"),
      });
    } catch (error) {
      toast({
        title: t("employees.profile.convertFailedTitle"),
        description:
          error instanceof Error ? error.message : t("employees.profile.unknownError"),
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const renewalCount = j.contractRenewals?.length ?? 0;
  const probationEnds =
    j.probationEndDate && (daysUntil(j.probationEndDate) ?? -1) > 0
      ? j.probationEndDate
      : null;

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
      <SEO title={fullName} noIndex />
      <BackLink t={t} />

      {/* Header — the identity, the status, and the actions on the record. */}
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={employee.photoUrl || ""} alt={fullName} />
          <AvatarFallback>
            {p.firstName?.[0]}
            {p.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
          <p className="text-sm text-foreground/70">
            {[
              j.position,
              // `TEMP1786…` is AddEmployee's placeholder until an ID document
              // is recorded (AddEmployee.tsx: primaryDocNumber || `TEMP${...}`).
              // It is a database-shaped identifier and must not be shown as if
              // it were the worker's ID — the directory already says "No ID yet".
              j.employeeId && !j.employeeId.startsWith("TEMP")
                ? j.employeeId
                : t("employees.noIdYet"),
            ]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={employee.status === "active" ? "default" : "secondary"}>
            {t(`employees.statusLabels.${employee.status}`) || employee.status}
          </Badge>
          {canManageTenant && p.email?.trim() && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAppInvite}
              disabled={inviting}
            >
              <Send className="mr-2 h-4 w-4" />
              {inviting
                ? t("employees.profile.inviteSending")
                : t("employees.profile.appInvite")}
            </Button>
          )}
          {canManageTenant && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const { downloadStaffCv } = await import(
                  "@/components/staff/StaffCvPdf"
                );
                await downloadStaffCv(employee);
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              {t("employees.profile.cvPdf")}
            </Button>
          )}
          {canManageTenant && (
            <Button size="sm" onClick={() => navigate(editHref)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("common.edit")}
            </Button>
          )}
        </div>
      </div>

      {canManageTenant && issues.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 space-y-2">
              <p className="font-medium">
                {t("employees.profile.needsAttention", {
                  count: issues.length,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {issues.map((issue) => (
                  <Badge
                    key={issue.field}
                    variant="outline"
                    className="border-amber-500/40"
                  >
                    {issue.issue}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showFixedTermWarning && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">
                  {t("employees.profile.fixedTermTitle")}
                </p>
                <p className="mt-0.5">
                  {elapsedOverLimit
                    ? t("employees.profile.fixedTermElapsed", {
                        date: formatDateTL(j.hireDate),
                      })
                    : t("employees.profile.fixedTermSpan", {
                        from: formatDateTL(j.hireDate),
                        to: formatDateTL(j.contractEndDate || ""),
                      })}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleConvert} disabled={converting}>
              {converting
                ? t("employees.profile.converting")
                : t("employees.profile.convertNow")}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-8 pb-8">
        {/* Mirrors addEmployee.section.who */}
        <Section title={t("employees.profile.sectionPersonal")}>
          <FieldGrid>
            <Field label={label("addEmployee.fields.firstName")} value={p.firstName} empty={notProvided} />
            <Field label={label("addEmployee.fields.lastName")} value={p.lastName} empty={notProvided} />
            <Field label={label("addEmployee.fields.email")} value={p.email} empty={notProvided} />
            <Field label={label("addEmployee.fields.phone")} value={p.phone} empty={notProvided} />
            <Field
              label={label("addEmployee.fields.appPhone")}
              value={p.phoneApp}
              empty={notProvided}
              badge={
                p.appEligible ? (
                  <Badge
                    variant="outline"
                    className="border-primary/30 px-1.5 py-0 text-[10px] text-primary"
                  >
                    {label("addEmployee.fields.appEligible")}
                  </Badge>
                ) : null
              }
            />
            <Field
              label={label("addEmployee.fields.dateOfBirth")}
              value={p.dateOfBirth ? formatDateTL(p.dateOfBirth) : ""}
              empty={notProvided}
            />
            <Field label={label("addEmployee.fields.address")} value={p.address} empty={notProvided} />
            <Field
              label={label("addEmployee.fields.emergencyName")}
              value={p.emergencyContactName}
              empty={notProvided}
            />
            <Field
              label={label("addEmployee.fields.emergencyPhone")}
              value={p.emergencyContactPhone}
              empty={notProvided}
            />
          </FieldGrid>
        </Section>

        {/* Mirrors addEmployee.section.job */}
        <Section title={t("employees.profile.sectionJob")}>
          <FieldGrid>
            <Field label={label("addEmployee.fields.department")} value={j.department} empty={notProvided} />
            <Field label={label("addEmployee.fields.jobTitle")} value={j.position} empty={notProvided} />
            <Field label={label("addEmployee.fields.manager")} value={managerName ?? ""} empty={notProvided} />
            <Field
              label={label("addEmployee.fields.startDate")}
              value={j.hireDate ? formatDateTL(j.hireDate) : ""}
              empty={notProvided}
            />
            <Field
              label={label("addEmployee.fields.employmentType")}
              value={j.employmentType}
              empty={notProvided}
              badge={
                renewalCount > 0 ? (
                  <Badge variant="outline">
                    {t("employees.profile.renewedTimes", {
                      count: renewalCount,
                    })}
                  </Badge>
                ) : null
              }
            />
            {j.contractEndDate && (
              <Field
                label={label("addEmployee.fields.contractEndDate")}
                value={formatDateTL(j.contractEndDate)}
                empty={notProvided}
              />
            )}
            {probationEnds && (
              <Field
                label={label("addEmployee.fields.probationEndDate")}
                value={formatDateTL(probationEnds)}
                empty={notProvided}
              />
            )}
            <Field
              label={t("employees.filterLabels.workLocation")}
              value={j.workLocation}
              empty={notProvided}
            />
            {j.projectCode && (
              <Field label={label("addEmployee.fields.projectCode")} value={j.projectCode} empty={notProvided} />
            )}
            {j.fundingSource && (
              <Field
                label={label("addEmployee.fields.fundingSource")}
                value={j.fundingSource}
                empty={notProvided}
              />
            )}
            <Field
              label={label("addEmployee.compensation.salaryLabel")}
              value={formatSalary(
                c.monthlySalary || Math.round((c.annualSalary ?? 0) / 12) || 0,
              )}
              empty={notProvided}
            />
            <Field
              label={label("addEmployee.compensation.leaveDays")}
              value={`${c.annualLeaveDays ?? 0}`}
              empty={notProvided}
            >
              {leaveBalance?.annual && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs font-medium text-primary">
                    {t("employees.profile.leaveRemaining", {
                      count: leaveBalance.annual.remaining,
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("employees.profile.leaveUsed", {
                      count: leaveBalance.annual.used,
                    })}
                  </span>
                  {leaveBalance.annual.pending > 0 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {t("employees.profile.leavePending", {
                        count: leaveBalance.annual.pending,
                      })}
                    </span>
                  )}
                </div>
              )}
            </Field>
            <Field
              label={label("addEmployee.compensation.benefits")}
              value={c.benefitsPackage}
              empty={notProvided}
            />
          </FieldGrid>
        </Section>

        {/* Mirrors addEmployee.section.ids */}
        <Section title={t("addEmployee.section.ids")}>
          <div className="mb-4 flex items-center gap-2">
            {d?.nationality ? (
              <>
                <span className="text-2xl leading-none">
                  {NATIONALITY_FLAGS[d.nationality] || ""}
                </span>
                <span className="text-sm font-medium">{d.nationality}</span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Flag className="h-4 w-4" />
                {t("employees.profile.noNationality")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DocumentField
              icon={<CreditCard className="h-4 w-4" />}
              label={t("employees.profile.docSocialSecurity")}
              number={d?.socialSecurityNumber?.number}
              expiryDate={d?.socialSecurityNumber?.expiryDate}
              t={t}
            />
            <DocumentField
              icon={<CreditCard className="h-4 w-4" />}
              label={t("employees.profile.docTin")}
              number={d?.taxIdentificationNumber?.number}
              expiryDate={d?.taxIdentificationNumber?.expiryDate}
              t={t}
            />
            <DocumentField
              icon={<Globe className="h-4 w-4" />}
              label={t("employees.profile.docElectoral")}
              number={d?.electoralCard?.number}
              expiryDate={d?.electoralCard?.expiryDate}
              t={t}
            />
            <DocumentField
              icon={<CreditCard className="h-4 w-4" />}
              label={t("employees.profile.docIdCard")}
              number={d?.idCard?.number}
              expiryDate={d?.idCard?.expiryDate}
              t={t}
            />
            <DocumentField
              icon={<Globe className="h-4 w-4" />}
              label={t("employees.profile.docPassport")}
              number={d?.passport?.number}
              expiryDate={d?.passport?.expiryDate}
              t={t}
            />
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {t("employees.profile.employmentDocuments")}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {label("addEmployee.fields.workContract")}
                  </span>
                </div>
                {d?.workContract?.fileUrl?.trim() ? (
                  <div className="space-y-1">
                    <Badge variant="secondary">
                      {t("employees.profile.documentUploaded")}
                    </Badge>
                    {d.workContract.uploadDate && (
                      <p className="text-xs text-muted-foreground">
                        {t("employees.profile.uploadedOn", {
                          date: formatDateTL(d.workContract.uploadDate),
                        })}
                      </p>
                    )}
                  </div>
                ) : canManageTenant ? (
                  <Link
                    to={editHref}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Pencil className="h-3 w-3" />
                    {t("employees.profile.uploadContract")}
                  </Link>
                ) : (
                  <p className="text-sm italic text-muted-foreground/60">
                    {notProvided}
                  </p>
                )}
              </div>

              {d?.nationality !== "Timor-Leste" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {t("employees.profile.workingVisa")}
                    </span>
                  </div>
                  {d?.workingVisaResidency?.number ? (
                    <div className="space-y-1">
                      <p className="text-sm">{d.workingVisaResidency.number}</p>
                      <ExpiryBadge
                        expiryDate={d.workingVisaResidency.expiryDate}
                        t={t}
                      />
                      {d.workingVisaResidency.fileUrl?.trim() ? (
                        <Badge variant="secondary">
                          {t("employees.profile.documentUploaded")}
                        </Badge>
                      ) : canManageTenant ? (
                        <Link
                          to={editHref}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <Pencil className="h-3 w-3" />
                          {t("employees.profile.uploadVisa")}
                        </Link>
                      ) : null}
                    </div>
                  ) : canManageTenant ? (
                    <Link
                      to={editHref}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Pencil className="h-3 w-3" />
                      {t("employees.profile.addVisa")}
                    </Link>
                  ) : (
                    <p className="text-sm italic text-muted-foreground/60">
                      {notProvided}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── presentational pieces ──────────────────────────────────────────

function BackLink({ t }: { t: (key: string) => string }) {
  return (
    <Link
      to="/people/employees"
      className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {t("employees.profile.backToEmployees")}
    </Link>
  );
}

/** Same heading shape the form uses, so the two screens read as one thing. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

/**
 * Label above value, matching the form's Label-above-Input rhythm. An unset
 * value reads as a muted "Not provided" rather than blank, so a gap is never
 * mistaken for a rendering failure.
 */
function Field({
  label,
  value,
  empty,
  badge,
  children,
}: {
  label: string;
  value?: string | null;
  empty: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const provided = value !== undefined && value !== null && value !== "";
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={
            provided
              ? "text-sm font-medium"
              : "text-sm italic text-muted-foreground/60"
          }
        >
          {provided ? value : empty}
        </p>
        {badge}
      </div>
      {children}
    </div>
  );
}

function ExpiryBadge({
  expiryDate,
  t,
}: {
  expiryDate?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (!expiryDate) return null;
  const days = daysUntil(expiryDate);
  if (days === null) return null;
  if (days < 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        {t("employees.profile.expired", { date: formatDateTL(expiryDate) })}
      </Badge>
    );
  }
  if (days <= 90) {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-xs">
        {t("employees.profile.expiresIn", { count: days })}
      </Badge>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      {t("employees.profile.expiresOn", { date: formatDateTL(expiryDate) })}
    </p>
  );
}

function DocumentField({
  icon,
  label,
  number,
  expiryDate,
  t,
}: {
  icon: React.ReactNode;
  label: string;
  number?: string;
  expiryDate?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="text-sm font-medium leading-tight">{label}</span>
      </div>
      {number ? (
        <div className="space-y-1">
          <p className="text-sm">{number}</p>
          <ExpiryBadge expiryDate={expiryDate} t={t} />
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground/60">
          {t("employees.profile.notProvided")}
        </p>
      )}
    </div>
  );
}
