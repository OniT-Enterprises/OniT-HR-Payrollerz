"use strict";
/**
 * HR Chat Cloud Function
 * Proxies OpenAI requests to keep API key secure on the server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.hrChat = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const v2_1 = require("firebase-functions/v2");
const db = (0, firestore_1.getFirestore)();
/**
 * Validates that the user has access to the specified tenant
 */
async function validateTenantAccess(uid, tenantId) {
    const userRecord = await (0, auth_1.getAuth)().getUser(uid);
    const customClaims = userRecord.customClaims || {};
    const tenants = customClaims.tenants || [];
    if (!tenants.includes(tenantId)) {
        throw new https_1.HttpsError("permission-denied", "User does not have access to this tenant");
    }
}
/**
 * Get OpenAI API key from tenant settings or global settings
 */
async function getOpenAIApiKey(tenantId) {
    // First try tenant-specific settings
    const tenantSettingsDoc = await db
        .doc(`tenants/${tenantId}/settings/integrations`)
        .get();
    if (tenantSettingsDoc.exists) {
        const data = tenantSettingsDoc.data();
        if (data === null || data === void 0 ? void 0 : data.openaiApiKey) {
            return data.openaiApiKey;
        }
    }
    // Fall back to global settings
    const globalSettingsDoc = await db.doc("system_config/integrations").get();
    if (globalSettingsDoc.exists) {
        const data = globalSettingsDoc.data();
        if (data === null || data === void 0 ? void 0 : data.openaiApiKey) {
            return data.openaiApiKey;
        }
    }
    return null;
}
/**
 * HR Chat - Proxies requests to OpenAI
 * Keeps the API key secure on the server side
 */
exports.hrChat = (0, https_1.onCall)({
    // Allow larger payloads for conversation history
    memory: "256MiB",
    timeoutSeconds: 60,
    // Rate limiting
    enforceAppCheck: false, // Enable in production
}, async (request) => {
    var _a, _b, _c;
    const { auth, data } = request;
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated");
    }
    const { tenantId, messages, model, maxTokens } = data;
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "Missing tenantId");
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Messages array is required");
    }
    // Validate tenant access
    await validateTenantAccess(auth.uid, tenantId);
    // Get API key from Firestore (secure server-side storage)
    const apiKey = await getOpenAIApiKey(tenantId);
    if (!apiKey) {
        throw new https_1.HttpsError("failed-precondition", "OpenAI API key not configured. Please configure it in Settings.");
    }
    try {
        v2_1.logger.info("HR Chat request", {
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
                v2_1.logger.error("OpenAI API key invalid", { tenantId });
                throw new https_1.HttpsError("failed-precondition", "Invalid OpenAI API key. Please check your configuration in Settings.");
            }
            if (response.status === 429) {
                v2_1.logger.warn("OpenAI rate limit hit", { tenantId });
                throw new https_1.HttpsError("resource-exhausted", "Rate limit exceeded. Please try again in a moment.");
            }
            v2_1.logger.error("OpenAI API error", {
                tenantId,
                status: response.status,
                error: errorText,
            });
            throw new https_1.HttpsError("internal", `OpenAI request failed: ${response.statusText}`);
        }
        const result = await response.json();
        // Check for API errors in response
        if (result === null || result === void 0 ? void 0 : result.error) {
            v2_1.logger.error("OpenAI API error in response", {
                tenantId,
                error: result.error,
            });
            throw new https_1.HttpsError("internal", result.error.message || "OpenAI API error");
        }
        const assistantMessage = (_c = (_b = (_a = result === null || result === void 0 ? void 0 : result.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
        if (!assistantMessage) {
            v2_1.logger.error("No content in OpenAI response", { tenantId, result });
            throw new https_1.HttpsError("internal", "No response content from OpenAI");
        }
        // Parse the JSON response
        try {
            const parsed = JSON.parse(assistantMessage);
            return {
                success: true,
                message: typeof (parsed === null || parsed === void 0 ? void 0 : parsed.message) === "string" ? parsed.message : assistantMessage,
                action: parsed === null || parsed === void 0 ? void 0 : parsed.action,
            };
        }
        catch (_d) {
            // If JSON parsing fails, return raw message
            return {
                success: true,
                message: assistantMessage,
            };
        }
    }
    catch (error) {
        // Re-throw HttpsErrors
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        v2_1.logger.error("HR Chat error", {
            tenantId,
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw new https_1.HttpsError("internal", "Failed to process chat request");
    }
});
exports.default = exports.hrChat;
//# sourceMappingURL=chat.js.map