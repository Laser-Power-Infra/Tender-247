"use server";

import { prisma } from "@/lib/prisma";

export async function updateTenderAssignmentsAction(params: {
  gemTenderId?: number;
  nonGemTenderId?: number;
  associationIds: number[];
}) {
  if (params.gemTenderId) {
    await prisma.tenderAssociation.deleteMany({ where: { gemTenderId: params.gemTenderId } });
    if (params.associationIds.length > 0) {
      await prisma.tenderAssociation.createMany({
        data: params.associationIds.map((associationId) => ({ gemTenderId: params.gemTenderId!, associationId })),
      });
    }
  } else if (params.nonGemTenderId) {
    await prisma.tenderAssociation.deleteMany({ where: { nonGemTenderId: params.nonGemTenderId } });
    if (params.associationIds.length > 0) {
      await prisma.tenderAssociation.createMany({
        data: params.associationIds.map((associationId) => ({ nonGemTenderId: params.nonGemTenderId!, associationId })),
      });
    }
  }
}

export async function updateTenderDecision(params: {
  id: number;
  type: "Gem" | "Non-Gem";
  field: "app" | "aps" | "apm";
  value: "YES" | "NO" | "NOT_DECIDED";
}) {
  const data = { [params.field]: params.value };
  try {
    console.log(data);
    if (params.type === "Gem") {
      await prisma.gemTender.update({ where: { id: params.id }, data });
    } else {
      await prisma.nonGemTender.update({ where: { id: params.id }, data });
    }
  } catch (error: any) {
    console.error(error);
  }
}
