import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  PRIMOS_BOOT_PARTNER,
  isAccountantPartnerTenant,
  type AccountantPartnerConnectionStatus,
} from "@/lib/accountantPartners";
import { accountantPartnerService } from "@/services/accountantPartnerService";

type ConfirmAction = "grant" | "revoke" | null;

export function AccountantPartnerCard() {
  const { session, refreshSession } = useTenant();
  const { t } = useI18n();
  const { toast } = useToast();
  const [working, setWorking] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  if (
    !session ||
    !["owner", "hr-admin"].includes(session.role) ||
    isAccountantPartnerTenant(session.tid)
  ) {
    return null;
  }

  const connection = session.config.accountantPartner;
  const status: AccountantPartnerConnectionStatus | "none" =
    connection?.partnerId === PRIMOS_BOOT_PARTNER.id
      ? connection.status
      : "none";
  const canGrant = session.role === "owner";
  const connectionsOpen = PRIMOS_BOOT_PARTNER.connectionsOpen;
  const partnershipPaused = !connectionsOpen && status !== "connected";

  const save = async (action: "request" | "cancel" | "grant" | "revoke") => {
    if (working) return;
    if (!connectionsOpen && (action === "request" || action === "grant")) return;
    setWorking(true);
    try {
      if (action === "request") {
        await accountantPartnerService.requestConnection(
          session.tid,
          PRIMOS_BOOT_PARTNER.id,
        );
      } else if (action === "cancel") {
        await accountantPartnerService.cancelConnection(
          session.tid,
          PRIMOS_BOOT_PARTNER.id,
        );
      } else if (action === "grant") {
        await accountantPartnerService.grantAccess(
          session.tid,
          PRIMOS_BOOT_PARTNER.id,
        );
      } else {
        await accountantPartnerService.revokeAccess(
          session.tid,
          PRIMOS_BOOT_PARTNER.id,
        );
      }
      await refreshSession();
      toast({
        title: t("common.success"),
        description: t("accountantPartners.connection.saved"),
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("accountantPartners.connection.error"),
        variant: "destructive",
      });
    } finally {
      setWorking(false);
      setConfirmAction(null);
    }
  };

  const showRequest =
    connectionsOpen &&
    ["none", "selected", "declined", "cancelled", "revoked"].includes(status);

  return (
    <>
      <Card id="accountant-partner" className="mt-6 scroll-mt-20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-muted">
                <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">
                    {PRIMOS_BOOT_PARTNER.name}
                  </h2>
                  {status !== "none" && (
                    <Badge variant="secondary">
                      {t(`accountantPartners.connection.status.${status}`)}
                    </Badge>
                  )}
                  {partnershipPaused && (
                    <Badge variant="outline">
                      {t("accountantPartners.connection.prelaunch")}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 max-w-prose text-xs leading-5 text-muted-foreground">
                  {t("accountantPartners.connection.description")}
                </p>
                {status === "none" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("accountantPartners.connection.none")}
                  </p>
                )}
                {partnershipPaused ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {t("accountantPartners.connection.prelaunchNote")}
                  </p>
                ) : showRequest ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {t("accountantPartners.connection.requestNote")}
                  </p>
                ) : null}
                {connectionsOpen && status === "accepted" && !canGrant && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    {t("accountantPartners.connection.ownerGrantOnly")}
                  </p>
                )}
                {connectionsOpen && status === "accepted" && canGrant && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {t("accountantPartners.connection.grantNote")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <Button variant="ghost" asChild>
                <Link to="/accountants">
                  {t("accountantPartners.connection.view")}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              {showRequest && (
                <Button onClick={() => void save("request")} disabled={working}>
                  {working && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("accountantPartners.connection.request")}
                </Button>
              )}
              {partnershipPaused && status !== "requested" && (
                <Button disabled>
                  {t("accountantPartners.connection.prelaunchAction")}
                </Button>
              )}
              {status === "requested" && (
                <Button
                  variant="outline"
                  onClick={() => void save("cancel")}
                  disabled={working}
                >
                  {working && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("accountantPartners.connection.cancel")}
                </Button>
              )}
              {connectionsOpen && status === "accepted" && canGrant && (
                <Button onClick={() => setConfirmAction("grant")} disabled={working}>
                  {t("accountantPartners.connection.grant")}
                </Button>
              )}
              {status === "connected" && canGrant && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmAction("revoke")}
                  disabled={working}
                >
                  {t("accountantPartners.connection.revoke")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "grant"
                ? t("accountantPartners.connection.confirmGrantTitle")
                : t("accountantPartners.connection.confirmRevokeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "grant"
                ? t("accountantPartners.connection.confirmGrantDescription")
                : t("accountantPartners.connection.confirmRevokeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (confirmAction) void save(confirmAction);
              }}
              disabled={working}
              className={
                confirmAction === "revoke"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {working && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmAction === "grant"
                ? t("accountantPartners.connection.grant")
                : t("accountantPartners.connection.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
