"use server";

import { openai } from "@ai-sdk/openai";
import { generateText, generateObject, APICallError } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const model = openai("gpt-4o-mini");

export async function analyzeContent(prompt: string) {
  const { text } = await generateText({
    model,
    prompt,
  });
  return text;
}

export async function analyzeContentWithSystem(system: string, prompt: string) {
  const { text } = await generateText({
    model,
    system,
    prompt,
  });
  return text;
}

type TenderAnalysisResult =
  | { success: true; data: { valid: boolean; reason: string } }
  | { success: false; error: "rate_limit" | "unknown" };

export async function analyzeTenderValidity(
  tenderBrief: string,
): Promise<TenderAnalysisResult> {
  try {
    const { object } = await generateObject({
      model,
      system: `Classify a tender as **Relevant** only if it explicitly includes the **supply, manufacture and supply, procurement, purchase, rate contract, annual rate contract, framework agreement, or supply and delivery** of one or more of the above products.

      Do NOT classify a tender as relevant if it relates only to:

      * Installation
      * Erection
      * Testing and Commissioning
      * Turnkey Projects
      * EPC Contracts
      * O&M Contracts
      * Civil Works
      * Transmission Line Construction
      * Substation Construction
      * Railway Electrification Works
      * Distribution Network Development
      * Service or Consultancy Contracts

      unless the tender contains a clearly separable and identifiable supply component for one or more of the listed products.

      For each relevant tender, provide:

      1. Tender Reference Number
      2. Tender Title
      3. Procuring Authority
      4. Product Category
      5. Exact Product(s) Matched
      6. Quantity or Estimated Value (if available)
      7. Submission Deadline
      8. Reason for Match. Return structured JSON with "valid" (boolean) and "reason" (string) fields.`,
      schema: z.object({
        valid: z.boolean(),
        reason: z.string(),
      }),
      prompt: `Analyze this tender brief:\n\n${tenderBrief}`,
    });
    return { success: true, data: object };
  } catch (error) {
    if (APICallError.isInstance(error) && error.statusCode === 429) {
      return { success: false, error: "rate_limit" };
    }
    return { success: false, error: "unknown" };
  }
}

export async function saveAiRelevance(params: {
  id: number;
  type: "Gem" | "Non-Gem";
  valid: boolean;
  reason: string;
}) {
  const data = { aiRelevanceValid: params.valid, aiRelevanceReason: params.reason };
  if (params.type === "Gem") {
    await prisma.gemTender.update({ where: { id: params.id }, data });
  } else {
    await prisma.nonGemTender.update({ where: { id: params.id }, data });
  }
}
