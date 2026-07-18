import { Building2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useI18n } from "@/i18n/I18nProvider";
import {
  PRIMOS_BOOT_PARTNER,
  type AccountantPartnerId,
} from "@/lib/accountantPartners";

interface AccountantChoiceProps {
  value: AccountantPartnerId | null;
  onChange: (value: AccountantPartnerId | null) => void;
  disabled?: boolean;
}

export function AccountantChoice({
  value,
  onChange,
  disabled = false,
}: AccountantChoiceProps) {
  const { t } = useI18n();
  const selectedValue = value ?? "self";

  return (
    <fieldset className="space-y-3 rounded-xl border border-border/70 p-3">
      <legend className="px-1 text-sm font-semibold">
        {t("accountantPartners.selection.title")}
      </legend>
      <p className="px-1 text-xs text-muted-foreground">
        {t("accountantPartners.selection.description")}
      </p>

      <RadioGroup
        value={selectedValue}
        onValueChange={(next) =>
          onChange(next === PRIMOS_BOOT_PARTNER.id ? PRIMOS_BOOT_PARTNER.id : null)
        }
        disabled={disabled}
        className="gap-2"
      >
        <label
          htmlFor="accountant-choice-self"
          className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
            selectedValue === "self"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/40"
          }`}
        >
          <RadioGroupItem
            id="accountant-choice-self"
            value="self"
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {t("accountantPartners.selection.self")}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {t("accountantPartners.selection.selfDescription")}
            </span>
          </span>
        </label>

        <label
          htmlFor="accountant-choice-primos"
          className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
            selectedValue === PRIMOS_BOOT_PARTNER.id
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/40"
          }`}
        >
          <RadioGroupItem
            id="accountant-choice-primos"
            value={PRIMOS_BOOT_PARTNER.id}
            className="mt-1"
          />
          <span className="flex h-7 w-16 shrink-0 items-center justify-center rounded border bg-muted">
            <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {t(
                PRIMOS_BOOT_PARTNER.connectionsOpen
                  ? "accountantPartners.selection.primos"
                  : "accountantPartners.selection.primosPrelaunch",
              )}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {t(
                PRIMOS_BOOT_PARTNER.connectionsOpen
                  ? "accountantPartners.selection.primosDescription"
                  : "accountantPartners.selection.primosPrelaunchDescription",
              )}
            </span>
          </span>
        </label>
      </RadioGroup>

      <p className="px-1 text-xs text-muted-foreground">
        {t("accountantPartners.selection.privacy")}
      </p>
    </fieldset>
  );
}
