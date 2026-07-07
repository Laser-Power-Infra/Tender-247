"use server";

import { openai } from "@ai-sdk/openai";
import { generateText, generateObject, APICallError, Output } from "ai";
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
    const { output } = await generateText({
      model,
      system: `You are a Tender Evaluation Expert. Determine if the following tender brief is related to supply of ANY of the following specific products:
Cables: LT Power Cables (Armoured and Unarmoured), MV Power Cables (Medium Voltage),Flexible Cablees, Bare Copper Conductor, Control Cables, Signalling Cables, Aerial Bunched (AB) Cables, PVC Cables, XLPE Cables.
Conductors: ACSR Conductors, AAC Conductors, AAAC Conductors, AL-59 Conductors, AL-7 Conductors, ASTER Conductors, HTLS AECC/TS Conductors, Medium Voltage Covered Conductors (MVCC).

IMPORTANT : IT SHOULD BE SUPPLY OF ABOVE MENTIONED PRODUCTS TO BE VALID. MENTION ITS NOT SUPPLY IF THEY DO NOT SAY SUPPLY OF THAT. 

Respond in EXACTLY the following format:
ANSWER: YES or NO
REASON: (a 1-sentence reason why it is or is not relevant to those exact products. Be concise.)`,
      output: Output.object({
        schema: z.object({
          valid: z.boolean(),
          reason: z.string(),
        }),
      }),
      prompt: `Analyze this tender brief:\n\n${tenderBrief}`,
    });
    return { success: true, data: output };
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
  const data = {
    aiRelevanceValid: params.valid,
    aiRelevanceReason: params.reason,
  };
  if (params.type === "Gem") {
    await prisma.gemTender.update({ where: { id: params.id }, data });
  } else {
    await prisma.nonGemTender.update({ where: { id: params.id }, data });
  }
}
