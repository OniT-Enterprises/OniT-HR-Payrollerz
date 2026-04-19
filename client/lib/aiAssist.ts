/**
 * Client helpers for AI-assisted writing features.
 * Routes through the Meza API's /ai/compose endpoint, which relays to the
 * OpenClaw bot gateway — keeping all model credentials server-side and sharing
 * the same infrastructure as the chat widget.
 */

import { auth } from "@/lib/firebase";

const API_BASE = import.meta.env.VITE_MEZA_API_URL || "https://meza.naroman.tl";

async function callComposeEndpoint(params: {
  tenantId: string;
  systemPrompt: string;
  userPrompt: string;
  purpose: string;
}): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error("You must be signed in to use AI features.");
  const token = await user.getIdToken();

  const res = await fetch(`${API_BASE}/api/tenants/${params.tenantId}/ai/compose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      purpose: params.purpose,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Compose request failed (HTTP ${res.status}).`);
  }

  const data = await res.json();
  if (!data?.success || typeof data.reply !== "string") {
    throw new Error("AI returned an empty response.");
  }
  return data.reply.trim();
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
    "Return the polished description as plain prose only — no preamble, no JSON wrapper, no code fences.",
    "Use short paragraphs and bullet points.",
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

  return callComposeEndpoint({
    tenantId,
    systemPrompt,
    userPrompt,
    purpose: "polish-job-description",
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
    "Return the customised handbook in markdown only — no preamble, no JSON wrapper, no code fences.",
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

  return callComposeEndpoint({
    tenantId,
    systemPrompt,
    userPrompt,
    purpose: "customise-handbook",
  });
}
