/**
 * HR Chat Cloud Function
 * Proxies OpenAI requests to keep API key secure on the server
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";

const db = getFirestore();

/**
 * Validates that the user has access to the specified tenant
 */
async function validateTenantAccess(
  uid: string,
  tenantId: string
): Promise<void> {
  const userRecord = await getAuth().getUser(uid);
  const customClaims = userRecord.customClaims || {};
  const tenants = customClaims.tenants || [];

  if (!tenants.includes(tenantId)) {
    throw new HttpsError(
      "permission-denied",
      "User does not have access to this tenant"
    );
  }
}

/**
 * Get OpenAI API key from tenant settings or global settings
 */
async function getOpenAIApiKey(tenantId: string): Promise<string | null> {
  // First try tenant-specific settings
  const tenantSettingsDoc = await db
    .doc(`tenants/${tenantId}/settings/integrations`)
    .get();

  if (tenantSettingsDoc.exists) {
    const data = tenantSettingsDoc.data();
    if (data?.openaiApiKey) {
      return data.openaiApiKey;
    }
  }

  // Fall back to global settings
  const globalSettingsDoc = await db.doc("system_config/integrations").get();

  if (globalSettingsDoc.exists) {
    const data = globalSettingsDoc.data();
    if (data?.openaiApiKey) {
      return data.openaiApiKey;
    }
  }

  return null;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface HRChatRequest {
  tenantId: string;
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
}

/**
 * HR Chat - Proxies requests to OpenAI
 * Keeps the API key secure on the server side
 */
export const hrChat = onCall(
  {
    // Allow larger payloads for conversation history
    memory: "256MiB",
    timeoutSeconds: 60,
    // Rate limiting
    enforceAppCheck: false, // Enable in production
  },
  async (request) => {
    const { auth, data } = request;

    if (!auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const { tenantId, messages, model, maxTokens } = data as HRChatRequest;

    if (!tenantId) {
      throw new HttpsError("invalid-argument", "Missing tenantId");
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError("invalid-argument", "Messages array is required");
    }

    // Validate tenant access
    await validateTenantAccess(auth.uid, tenantId);

    // Get API key from Firestore (secure server-side storage)
    const apiKey = await getOpenAIApiKey(tenantId);

    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "OpenAI API key not configured. Please configure it in Settings."
      );
    }

    try {
      logger.info("HR Chat request", {
        tenantId,
        userId: auth.uid,
        messageCount: messages.length,
      });

      // Call OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages,
          max_completion_tokens: maxTokens || 2000,
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
          `OpenAI request failed: ${response.statusText}`
        );
      }

      const result = await response.json();

      // Check for API errors in response
      if (result?.error) {
        logger.error("OpenAI API error in response", {
          tenantId,
          error: result.error,
        });
        throw new HttpsError(
          "internal",
          result.error.message || "OpenAI API error"
        );
      }

      const assistantMessage = result?.choices?.[0]?.message?.content;

      if (!assistantMessage) {
        logger.error("No content in OpenAI response", { tenantId, result });
        throw new HttpsError("internal", "No response content from OpenAI");
      }

      // Parse the JSON response
      try {
        const parsed = JSON.parse(assistantMessage);
        return {
          success: true,
          message: typeof parsed?.message === "string" ? parsed.message : assistantMessage,
          action: parsed?.action,
        };
      } catch {
        // If JSON parsing fails, return raw message
        return {
          success: true,
          message: assistantMessage,
        };
      }
    } catch (error) {
      // Re-throw HttpsErrors
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("HR Chat error", {
        tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new HttpsError("internal", "Failed to process chat request");
    }
  }
);

// Export the function
export { hrChat as default };
