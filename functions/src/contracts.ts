/**
 * Contract Quick Fill Cloud Function
 * Fills a work contract template with employee/company data using AI.
 * Handles templates with dotted blanks ("......"), underscores, and
 * {{token}} placeholders while preserving the original wording/language.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { requireAuth, requireTenantMember } from "./authz";
import { getOpenAIApiKey } from "./chat";

const MAX_TEMPLATE_CHARS = 30000;
const MAX_DATA_CHARS = 8000;
const APP_CHECK_ENFORCED = process.env.ENFORCE_APP_CHECK === "true";

interface ContractQuickFillRequest {
  tenantId: string;
  templateText: string;
  /** Flattened employee/company/contract data, e.g. { employee: {...}, company: {...} } */
  data: Record<string, Record<string, string>>;
}

const SYSTEM_PROMPT = [
  "You fill employment contract templates for an HR system in Timor-Leste.",
  "You receive a contract template and structured data about the employer (company) and the employee.",
  "Fill the template with the data:",
  "- Replace dotted blanks (e.g. \"..........\", \"………\"), underscore blanks, and {{token}} placeholders with the matching values.",
  "- Choose the correct value for each blank from its surrounding context (name, address, TIN, salary, dates, job title, etc.).",
  "- Keep every other word of the template EXACTLY as written, in its original language (Portuguese, Tetun, or English). Do not translate, reorder, shorten, or add clauses.",
  "- If no matching value exists for a blank, keep the blank unchanged.",
  "- Format dates as DD/MM/YYYY and salary amounts in US dollars.",
  "- Where the template offers alternatives like \"Male/Female\", keep them unchanged unless the data clearly selects one.",
  "Respond in JSON: {\"contract\": \"<the full filled contract text>\"}.",
].join("\n");

export const contractQuickFill = onCall(
  {
    memory: "256MiB",
    timeoutSeconds: 120,
    enforceAppCheck: APP_CHECK_ENFORCED,
  },
  async (request) => {
    const auth = requireAuth(request);
    const { tenantId, templateText, data } =
      request.data as ContractQuickFillRequest;

    if (!tenantId) {
      throw new HttpsError("invalid-argument", "Missing tenantId");
    }
    if (typeof templateText !== "string" || templateText.trim().length === 0) {
      throw new HttpsError("invalid-argument", "Template text is required");
    }
    if (templateText.length > MAX_TEMPLATE_CHARS) {
      throw new HttpsError("invalid-argument", "Template text is too long");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new HttpsError("invalid-argument", "Fill data is required");
    }

    const dataJson = JSON.stringify(data);
    if (dataJson.length > MAX_DATA_CHARS) {
      throw new HttpsError("invalid-argument", "Fill data is too large");
    }

    await requireTenantMember(tenantId, auth.uid);

    const apiKey = await getOpenAIApiKey(tenantId);
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "AI is not configured. Ask your administrator to add an OpenAI API key in Settings."
      );
    }

    try {
      logger.info("Contract quick fill request", {
        tenantId,
        userId: auth.uid,
        templateChars: templateText.length,
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `TEMPLATE:\n---\n${templateText}\n---\n\nDATA (JSON):\n${dataJson}`,
            },
          ],
          max_completion_tokens: 8000,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        if (response.status === 401) {
          logger.error("OpenAI API key invalid", { tenantId });
          throw new HttpsError(
            "failed-precondition",
            "Invalid OpenAI API key. Please check your configuration in Settings."
          );
        }
        if (response.status === 429) {
          logger.warn("OpenAI rate limit hit", { tenantId });
          throw new HttpsError(
            "resource-exhausted",
            "Rate limit exceeded. Please try again in a moment."
          );
        }

        logger.error("OpenAI API error", {
          tenantId,
          status: response.status,
          error: errorText,
        });
        throw new HttpsError(
          "internal",
          `AI request failed: ${response.statusText}`
        );
      }

      const result = await response.json();
      const choice = result?.choices?.[0];
      const finishReason = choice?.finish_reason;
      const content = choice?.message?.content;

      // A truncated completion (finish_reason "length") yields partial or
      // malformed JSON. Never fall back to persisting that as the legal
      // contract — fail loudly so the caller sees a real error.
      if (finishReason === "length") {
        logger.error("OpenAI response truncated (finish_reason=length)", {
          tenantId,
          templateChars: templateText.length,
        });
        throw new HttpsError(
          "resource-exhausted",
          "The contract template is too large to fill in one pass. Please shorten the template or split it into sections and try again."
        );
      }

      if (!content) {
        logger.error("No content in OpenAI response", {
          tenantId,
          finishReason,
        });
        throw new HttpsError("internal", "No response content from AI");
      }

      // Parse strictly: on malformed JSON or a missing/non-string contract
      // field, throw rather than persisting the raw (possibly partial) text.
      let contract: string;
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed?.contract !== "string") {
          throw new Error("AI response missing a 'contract' string field");
        }
        contract = parsed.contract;
      } catch (parseError) {
        logger.error("Failed to parse AI contract response", {
          tenantId,
          finishReason,
          error:
            parseError instanceof Error ? parseError.message : "parse error",
        });
        throw new HttpsError(
          "internal",
          "AI returned a malformed contract. Please try again."
        );
      }

      if (!contract.trim()) {
        throw new HttpsError("internal", "AI returned an empty contract");
      }

      return { success: true, contract };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Contract quick fill error", {
        tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new HttpsError("internal", "Failed to fill the contract template");
    }
  }
);
