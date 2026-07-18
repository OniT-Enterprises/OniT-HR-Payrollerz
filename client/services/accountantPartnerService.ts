import { httpsCallable } from "firebase/functions";
import { getFunctionsLazy } from "@/lib/firebase-core";
import type {
  AccountantPartnerConnectionStatus,
  AccountantPartnerId,
} from "@/lib/accountantPartners";

export interface AccountantPartnerPortfolioItem {
  requestId: string;
  tenantId: string;
  tenantName: string;
  partnerId: AccountantPartnerId;
  status: AccountantPartnerConnectionStatus;
  requesterName?: string;
  requesterEmail?: string;
  requestedAt?: string;
  updatedAt?: string;
}

async function callFunction<Input, Output>(
  name: string,
  input: Input,
): Promise<Output> {
  const functions = await getFunctionsLazy();
  const callable = httpsCallable<Input, Output>(functions, name);
  const result = await callable(input);
  return result.data;
}

export const accountantPartnerService = {
  requestConnection(tenantId: string, partnerId: AccountantPartnerId) {
    return callFunction<
      { tenantId: string; partnerId: AccountantPartnerId },
      { status: AccountantPartnerConnectionStatus }
    >("requestAccountantPartnerConnection", { tenantId, partnerId });
  },

  cancelConnection(tenantId: string, partnerId: AccountantPartnerId) {
    return callFunction<
      { tenantId: string; partnerId: AccountantPartnerId },
      { status: AccountantPartnerConnectionStatus }
    >("cancelAccountantPartnerConnection", { tenantId, partnerId });
  },

  getPortfolio(partnerId: AccountantPartnerId) {
    return callFunction<
      { partnerId: AccountantPartnerId },
      { items: AccountantPartnerPortfolioItem[] }
    >("getAccountantPartnerPortfolio", { partnerId });
  },

  respondToRequest(
    requestId: string,
    decision: "accept" | "decline",
  ) {
    return callFunction<
      { requestId: string; decision: "accept" | "decline" },
      { status: AccountantPartnerConnectionStatus }
    >("respondToAccountantPartnerRequest", { requestId, decision });
  },

  activateClientAccess(requestId: string) {
    return callFunction<
      { requestId: string },
      { tenantId: string; tenantName: string; role: "accountant" }
    >("activateAccountantPartnerClientAccess", { requestId });
  },

  grantAccess(tenantId: string, partnerId: AccountantPartnerId) {
    return callFunction<
      { tenantId: string; partnerId: AccountantPartnerId },
      { status: AccountantPartnerConnectionStatus }
    >("grantAccountantPartnerAccess", { tenantId, partnerId });
  },

  revokeAccess(tenantId: string, partnerId: AccountantPartnerId) {
    return callFunction<
      { tenantId: string; partnerId: AccountantPartnerId },
      { status: AccountantPartnerConnectionStatus }
    >("revokeAccountantPartnerAccess", { tenantId, partnerId });
  },
};
