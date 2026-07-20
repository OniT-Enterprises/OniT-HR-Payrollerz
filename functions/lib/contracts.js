"use strict";
/**
 * Contract Quick Fill Cloud Function
 * Fills a work contract template with employee/company data using AI.
 * Handles templates with dotted blanks ("......"), underscores, and
 * {{token}} placeholders while preserving the original wording/language.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractQuickFill = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const authz_1 = require("./authz");
const chat_1 = require("./chat");
const MAX_TEMPLATE_CHARS = 30000;
const MAX_DATA_CHARS = 8000;
const APP_CHECK_ENFORCED = process.env.ENFORCE_APP_CHECK === "true";
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
exports.contractQuickFill = (0, https_1.onCall)({
    memory: "256MiB",
    timeoutSeconds: 120,
    enforceAppCheck: APP_CHECK_ENFORCED,
}, async (request) => {
    var _a, _b;
    const auth = (0, authz_1.requireAuth)(request);
    const { tenantId, templateText, data } = request.data;
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "Missing tenantId");
    }
    if (typeof templateText !== "string" || templateText.trim().length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Template text is required");
    }
    if (templateText.length > MAX_TEMPLATE_CHARS) {
        throw new https_1.HttpsError("invalid-argument", "Template text is too long");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new https_1.HttpsError("invalid-argument", "Fill data is required");
    }
    const dataJson = JSON.stringify(data);
    if (dataJson.length > MAX_DATA_CHARS) {
        throw new https_1.HttpsError("invalid-argument", "Fill data is too large");
    }
    await (0, authz_1.requireTenantMember)(tenantId, auth.uid);
    const apiKey = await (0, chat_1.getOpenAIApiKey)(tenantId);
    if (!apiKey) {
        throw new https_1.HttpsError("failed-precondition", "AI is not configured. Ask your administrator to add an OpenAI API key in Settings.");
    }
    try {
        v2_1.logger.info("Contract quick fill request", {
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
            throw new https_1.HttpsError("internal", `AI request failed: ${response.statusText}`);
        }
        const result = await response.json();
        const choice = (_a = result === null || result === void 0 ? void 0 : result.choices) === null || _a === void 0 ? void 0 : _a[0];
        const finishReason = choice === null || choice === void 0 ? void 0 : choice.finish_reason;
        const content = (_b = choice === null || choice === void 0 ? void 0 : choice.message) === null || _b === void 0 ? void 0 : _b.content;
        // A truncated completion (finish_reason "length") yields partial or
        // malformed JSON. Never fall back to persisting that as the legal
        // contract — fail loudly so the caller sees a real error.
        if (finishReason === "length") {
            v2_1.logger.error("OpenAI response truncated (finish_reason=length)", {
                tenantId,
                templateChars: templateText.length,
            });
            throw new https_1.HttpsError("resource-exhausted", "The contract template is too large to fill in one pass. Please shorten the template or split it into sections and try again.");
        }
        if (!content) {
            v2_1.logger.error("No content in OpenAI response", {
                tenantId,
                finishReason,
            });
            throw new https_1.HttpsError("internal", "No response content from AI");
        }
        // Parse strictly: on malformed JSON or a missing/non-string contract
        // field, throw rather than persisting the raw (possibly partial) text.
        let contract;
        try {
            const parsed = JSON.parse(content);
            if (typeof (parsed === null || parsed === void 0 ? void 0 : parsed.contract) !== "string") {
                throw new Error("AI response missing a 'contract' string field");
            }
            contract = parsed.contract;
        }
        catch (parseError) {
            v2_1.logger.error("Failed to parse AI contract response", {
                tenantId,
                finishReason,
                error: parseError instanceof Error ? parseError.message : "parse error",
            });
            throw new https_1.HttpsError("internal", "AI returned a malformed contract. Please try again.");
        }
        if (!contract.trim()) {
            throw new https_1.HttpsError("internal", "AI returned an empty contract");
        }
        return { success: true, contract };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        v2_1.logger.error("Contract quick fill error", {
            tenantId,
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw new https_1.HttpsError("internal", "Failed to fill the contract template");
    }
});
//# sourceMappingURL=contracts.js.map