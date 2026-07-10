/**
 * TemplatePicker — visual invoice template & accent color selector
 * CSS-drawn mini thumbnails of the three templates; used in the invoice
 * editor sidebar and the invoice settings page.
 */

import { Check } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import type { InvoiceTemplateId } from '@/types/money';
import { INVOICE_TEMPLATES, ACCENT_COLORS } from '@/lib/invoiceTemplates';

interface TemplatePickerProps {
  value: InvoiceTemplateId;
  onChange: (id: InvoiceTemplateId) => void;
  accentColor?: string;
  onAccentChange?: (hex: string) => void;
  /** Hide the accent color row (editor uses invoice-level accent from settings) */
  showAccent?: boolean;
  compact?: boolean;
}

/** Schematic mini-preview of a template */
function TemplateThumb({ id, accent }: { id: InvoiceTemplateId; accent: string }) {
  const line = (w: string, color = '#d1d5db', h = 3) => (
    <div style={{ width: w, height: h, backgroundColor: color, borderRadius: 1 }} />
  );

  if (id === 'modern') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[3px] bg-white">
        <div className="flex items-start justify-between p-1.5" style={{ backgroundColor: accent, height: '30%' }}>
          <div className="mt-0.5 h-2.5 w-2.5 rounded-sm bg-white/90" />
          <div className="mt-0.5 h-1.5 w-6 rounded-sm bg-white/70" />
        </div>
        <div className="flex flex-1 flex-col gap-1 p-1.5">
          {line('55%')}
          {line('40%')}
          <div className="mt-auto space-y-1">
            <div style={{ width: '100%', height: 3, backgroundColor: accent, borderRadius: 1, opacity: 0.85 }} />
            {line('100%', '#e5e7eb')}
            {line('100%', '#e5e7eb')}
            <div className="ml-auto" style={{ width: '35%', height: 5, backgroundColor: accent, borderRadius: 2 }} />
          </div>
        </div>
      </div>
    );
  }

  if (id === 'minimal') {
    return (
      <div className="flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-[3px] bg-white p-2">
        <div className="flex items-start justify-between">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#d1d5db' }} />
          <div style={{ width: '30%', height: 4, backgroundColor: accent, borderRadius: 1, opacity: 0.8 }} />
        </div>
        <div className="mt-1 space-y-1">
          {line('45%')}
          {line('30%', '#e5e7eb')}
        </div>
        <div className="mt-auto space-y-1.5">
          {line('100%', '#f3f4f6', 2)}
          {line('100%', '#f3f4f6', 2)}
          {line('100%', '#f3f4f6', 2)}
          <div className="ml-auto" style={{ width: '30%', height: 3, backgroundColor: accent, borderRadius: 1 }} />
        </div>
      </div>
    );
  }

  // classic
  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-hidden rounded-[3px] bg-white p-1.5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#d1d5db' }} />
          {line('100%', '#d1d5db', 2)}
        </div>
        <div style={{ width: '28%', height: 5, backgroundColor: accent, borderRadius: 1, opacity: 0.9 }} />
      </div>
      <div style={{ width: '100%', height: 2.5, backgroundColor: accent, borderRadius: 1 }} />
      <div className="flex justify-between gap-2">
        {line('35%')}
        {line('25%', '#e5e7eb')}
      </div>
      <div className="mt-auto space-y-1">
        {line('100%', '#e5e7eb')}
        {line('100%', '#e5e7eb')}
        <div className="ml-auto" style={{ width: '30%', height: 3, backgroundColor: accent, borderRadius: 1 }} />
      </div>
    </div>
  );
}

export function TemplatePicker({
  value,
  onChange,
  accentColor = ACCENT_COLORS[0].value,
  onAccentChange,
  showAccent = false,
  compact = false,
}: TemplatePickerProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {INVOICE_TEMPLATES.map((template) => {
          const selected = value === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange(template.id)}
              aria-pressed={selected}
              className={`group relative rounded-lg border-2 p-2 text-left transition-all ${
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40'
              }`}
            >
              <div className="aspect-[3/4] w-full overflow-hidden rounded border border-border/60 bg-muted/40">
                <TemplateThumb id={template.id} accent={accentColor} />
              </div>
              <p className="mt-2 text-xs font-semibold">
                {t(`money.invoices.template_${template.id}`) || template.name}
              </p>
              {!compact && (
                <p className="text-[11px] leading-tight text-muted-foreground">
                  {t(`money.invoices.template_${template.id}Desc`) || template.description}
                </p>
              )}
              {selected && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showAccent && onAccentChange && (
        <div>
          <p className="mb-2 text-sm font-medium">
            {t('money.invoices.accentColor') || 'Accent color'}
          </p>
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map((color) => {
              const selected = accentColor.toLowerCase() === color.value.toLowerCase();
              return (
                <button
                  key={color.value}
                  type="button"
                  title={color.name}
                  aria-pressed={selected}
                  onClick={() => onAccentChange(color.value)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                    selected ? 'ring-2 ring-offset-2 ring-offset-background' : ''
                  }`}
                  style={{ backgroundColor: color.value, ...(selected ? { boxShadow: `0 0 0 2px var(--background), 0 0 0 4px ${color.value}` } : {}) }}
                >
                  {selected && <Check className="h-4 w-4 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplatePicker;
