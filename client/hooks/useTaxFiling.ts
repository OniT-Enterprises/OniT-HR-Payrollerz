/**
 * React Query hooks for tax filing data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { taxFilingService } from '@/services/taxFilingService';
import type { TaxFilingType, MonthlyWITReturn, AnnualWITReturn, MonthlyINSSReturn, SubmissionMethod, CompanyDetails } from '@/services/taxFilingService';
import type { AuditContext } from '@/services/employeeService';

export const taxFilingKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'taxFilings'] as const,
  lists: (tenantId: string) => [...taxFilingKeys.all(tenantId), 'list'] as const,
  byType: (tenantId: string, type: TaxFilingType) => [...taxFilingKeys.lists(tenantId), type] as const,
  byPeriod: (tenantId: string, type: TaxFilingType, period: string) => [...taxFilingKeys.all(tenantId), type, period] as const,
  dueSoon: (tenantId: string, months: number) => [...taxFilingKeys.all(tenantId), 'dueSoon', months] as const,
  statusSummary: (tenantId: string) => [...taxFilingKeys.all(tenantId), 'statusSummary'] as const,
};

/** Fetch all tax filings, optionally filtered by type */
export function useTaxFilings(type?: TaxFilingType) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: type ? taxFilingKeys.byType(tenantId, type) : taxFilingKeys.lists(tenantId),
    queryFn: () => taxFilingService.getAllFilings(tenantId, type),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch a filing by type and period */
export function useTaxFilingByPeriod(type: TaxFilingType, period: string, enabled: boolean = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: taxFilingKeys.byPeriod(tenantId, type, period),
    queryFn: () => taxFilingService.getFilingByPeriod(type, period, tenantId),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch filings due soon */
export function useTaxFilingsDueSoon(months: number = 6) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: taxFilingKeys.dueSoon(tenantId, months),
    queryFn: () => taxFilingService.getFilingsDueSoon(tenantId, months),
    staleTime: 5 * 60 * 1000,
  });
}

/** Generate monthly WIT return */
export function useGenerateMonthlyWIT() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ period, company }: { period: string; company: Partial<CompanyDetails> }) =>
      taxFilingService.generateMonthlyWITReturn(period, company, tenantId),
  });
}

/** Generate monthly INSS return */
export function useGenerateMonthlyINSS() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ period, company }: { period: string; company: Partial<CompanyDetails> }) =>
      taxFilingService.generateMonthlyINSSReturn(period, company, tenantId),
  });
}

/** Save a tax filing */
export function useSaveTaxFiling() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ type, period, dataSnapshot, userId, audit }: {
      type: TaxFilingType;
      period: string;
      dataSnapshot: MonthlyWITReturn | AnnualWITReturn | MonthlyINSSReturn;
      userId: string;
      audit?: AuditContext;
    }) => taxFilingService.saveFiling(type, period, dataSnapshot, userId, tenantId, audit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taxFilingKeys.all(tenantId) });
    },
  });
}

/** Mark a filing as filed */
export function useMarkTaxFilingAsFiled() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ filingId, method, receiptNumber, notes, userId, audit }: {
      filingId: string;
      method: SubmissionMethod;
      receiptNumber?: string;
      notes?: string;
      userId?: string;
      audit?: AuditContext;
    }) => taxFilingService.markAsFiled(filingId, method, receiptNumber, notes, userId, audit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taxFilingKeys.all(tenantId) });
    },
  });
}
