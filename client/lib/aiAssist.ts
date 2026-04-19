/**
 * Thin client wrapper around the hrChat Cloud Function.
 * Uses the existing OpenAI proxy — keeps API keys server-side.
 */

import { getFunctionsLazy } from "@/lib/firebase";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface HRChatResponse {
  success: boolean;
  message: string;
  action?: unknown;
}

export async function callHRChat(params: {
  tenantId: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<string> {
  const { httpsCallable } = await import("firebase/functions");
  const hrChat = httpsCallable<
    { tenantId: string; messages: ChatMessage[]; maxTokens?: number },
    HRChatResponse
  >(await getFunctionsLazy(), "hrChat");

  const result = await hrChat(params);
  const data = result.data;
  if (!data?.success) {
    throw new Error("AI request failed");
  }
  return data.message;
}

export async function polishJobDescription(params: {
  tenantId: string;
  title: string;
  rough: string;
  department?: string;
  location?: string;
}): Promise<string> {
  const { tenantId, title, rough, department, location } = params;
  const systemPrompt = [
    "You polish job descriptions for Timor-Leste employers.",
    "Return ONLY JSON of the form {\"message\": \"<polished description>\"}.",
    "The description should have short paragraphs and bullet points.",
    "Include: role summary, key responsibilities, requirements, and nice-to-haves.",
    "Keep it professional, plain English, 150–300 words. No emojis.",
  ].join(" ");

  const userPrompt = [
    `Job title: ${title}`,
    department ? `Department: ${department}` : "",
    location ? `Location: ${location}` : "",
    "",
    "Rough notes from the hiring manager:",
    rough,
  ]
    .filter(Boolean)
    .join("\n");

  return callHRChat({
    tenantId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 800,
  });
}

export async function customizeHandbook(params: {
  tenantId: string;
  companyName: string;
  industry?: string;
  baseHandbook: string;
}): Promise<string> {
  const { tenantId, companyName, industry, baseHandbook } = params;
  const systemPrompt = [
    "You adapt a generic employee handbook for a specific Timor-Leste employer.",
    "Return ONLY JSON of the form {\"message\": \"<customized handbook in markdown>\"}.",
    "Preserve the structure (sections & headings). Replace placeholders with the company name and industry-appropriate details.",
    "Keep the tone professional and friendly. Stay under 1500 words.",
  ].join(" ");

  const userPrompt = [
    `Company: ${companyName}`,
    industry ? `Industry: ${industry}` : "",
    "",
    "Base handbook:",
    baseHandbook,
  ]
    .filter(Boolean)
    .join("\n");

  return callHRChat({
    tenantId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 2000,
  });
}
