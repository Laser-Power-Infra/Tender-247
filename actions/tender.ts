"use server";

import { prisma } from "@/lib/prisma";
import { sendTenderWebhook } from "@/lib/webhook";

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
    const gemTender = await prisma.gemTender.findUnique({
      where: { id: params.gemTenderId },
      include: { tenderAssociations: { include: { association: true } } },
    });
    if (gemTender && gemTender.apm === "YES" && gemTender.tenderAssociations.length > 0) {
      const { referenceNo, itemCategory, organization, deadline, tenderFileUrl } = gemTender as any;
      sendTenderWebhook({ referenceNo, itemCategory, organization, deadline, tenderFileUrl }, "Gem", gemTender.tenderAssociations);
    }
  } else if (params.nonGemTenderId) {
    await prisma.tenderAssociation.deleteMany({ where: { nonGemTenderId: params.nonGemTenderId } });
    if (params.associationIds.length > 0) {
      await prisma.tenderAssociation.createMany({
        data: params.associationIds.map((associationId) => ({ nonGemTenderId: params.nonGemTenderId!, associationId })),
      });
    }
    const nonGemTender = await prisma.nonGemTender.findUnique({
      where: { id: params.nonGemTenderId },
      include: { tenderAssociations: { include: { association: true } } },
    });
    if (nonGemTender && nonGemTender.apm === "YES" && nonGemTender.tenderAssociations.length > 0) {
      const { referenceNo, itemCategory, organization, deadline, tenderFileUrl } = nonGemTender as any;
      sendTenderWebhook({ referenceNo, itemCategory, organization, deadline, tenderFileUrl }, "Non-Gem", nonGemTender.tenderAssociations);
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
      if (params.field === "apm" && params.value === "YES") {
        const tender = await prisma.gemTender.findUnique({
          where: { id: params.id },
          include: { tenderAssociations: { include: { association: true } } },
        });
        if (tender && tender.tenderAssociations.length > 0) {
          const { referenceNo, itemCategory, organization, deadline, tenderFileUrl } = tender as any;
          sendTenderWebhook({ referenceNo, itemCategory, organization, deadline, tenderFileUrl }, "Gem", tender.tenderAssociations);
        }
      }
    } else {
      await prisma.nonGemTender.update({ where: { id: params.id }, data });
      if (params.field === "apm" && params.value === "YES") {
        const tender = await prisma.nonGemTender.findUnique({
          where: { id: params.id },
          include: { tenderAssociations: { include: { association: true } } },
        });
        if (tender && tender.tenderAssociations.length > 0) {
          const { referenceNo, itemCategory, organization, deadline, tenderFileUrl } = tender as any;
          sendTenderWebhook({ referenceNo, itemCategory, organization, deadline, tenderFileUrl }, "Non-Gem", tender.tenderAssociations);
        }
      }
    }
  } catch (error: any) {
    console.error(error);
  }
}
