import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface FlatRow {
  type: "Gem" | "Non-Gem";
  id: string;
  [key: string]: string;
}

const GEM_DISPLAY_FIELDS = [
  "referenceNo", "tenderBrief", "value", "deadline", "location",
  "organization", "documentFees", "emd", "msmeExemption",
  "startupExemption", "quantity", "bidOpeningDateTime",
  "bidOfferValidity", "ministryStateName", "departmentName",
  "officeName", "minimumAverageAnnualTurnover", "yearsOfPastExperience",
  "oemAverageTurnover", "contractPeriod",
  "financialDocumentPriceBreakupRequired", "similarCategory",
  "pastExperienceSimilarServicesRequired", "documentRequiredFromSeller",
  "pastPerformance", "bidToRaEnabled", "raQualificationRule",
  "boqTitle", "bidDetails", "comprehensiveMaintenanceChargesRequired",
  "typeOfBid", "technicalClarificationTimeAllowed", "inspectionRequired",
  "estimatedBidValue", "evaluationMethod", "advisoryBank",
  "ePbgPercentage", "ePbgDurationMonths", "msePurchasePreference",
  "miiPurchasePreference", "consigneesReportingOfficer",
  "mediationClause", "arbitrationClause", "checklist",
  "t247Id", "scrapedDate", "source", "assignedTo",
  "markedStatus", "sheetStatus", "ready", "searchKey",
  "downloadLink", "currency",
] as const;

const NON_GEM_DISPLAY_FIELDS = [
  "referenceNo", "tenderBrief", "estimatedBidValue", "deadline",
  "location", "organization", "documentFees", "emd",
  "msmeExemption", "startupExemption", "quantity", "checklist",
  "t247Id", "scrapedDate", "source", "assignedTo",
  "markedStatus", "sheetStatus", "ready", "searchKey",
  "downloadLink", "currency",
] as const;

const ALL_KNOWN_FIELDS = [
  ...new Set([
    ...GEM_DISPLAY_FIELDS,
    ...NON_GEM_DISPLAY_FIELDS,
    "aiRelevanceValid",
    "aiRelevanceReason",
    "excludedCategory",
    "tenderFileUrl",
  ]),
];

function flattenTender(
  tender: Record<string, unknown>,
  extraFields: { fieldName: string; fieldValue: string | null }[],
  type: "Gem" | "Non-Gem",
  id: number,
): FlatRow {
  const row: FlatRow = { type, id: String(id) };

  for (const field of ALL_KNOWN_FIELDS) {
    const val = tender[field];
    if (val instanceof Date) {
      row[field] = val.toISOString().split("T")[0];
    } else {
      row[field] = val == null ? "" : String(val);
    }
  }

  for (const ef of extraFields) {
    row[ef.fieldName] = ef.fieldValue ?? "";
  }

  return row;
}

export async function GET(request: NextRequest) {
  try {
    const fileIdStr = request.nextUrl.searchParams.get("fileId");
    if (!fileIdStr) {
      return NextResponse.json(
        { error: "fileId query parameter is required" },
        { status: 400 }
      );
    }
    const fileId = parseInt(fileIdStr, 10);
    if (isNaN(fileId)) {
      return NextResponse.json({ error: "invalid fileId" }, { status: 400 });
    }

    const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });
    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const [gemTenders, nonGemTenders] = await Promise.all([
      prisma.gemTender.findMany({
        where: { fileId },
        include: { extraFields: true },
      }),
      prisma.nonGemTender.findMany({
        where: { fileId },
        include: { extraFields: true },
      }),
    ]);

    const rows: FlatRow[] = [];

    for (const t of gemTenders) {
      rows.push(flattenTender(t as unknown as Record<string, unknown>, t.extraFields, "Gem", t.id));
    }
    for (const t of nonGemTenders) {
      rows.push(flattenTender(t as unknown as Record<string, unknown>, t.extraFields, "Non-Gem", t.id));
    }

    const allExtraFieldNames = [
      ...new Set(
        [...gemTenders, ...nonGemTenders].flatMap((t) =>
          t.extraFields.map((ef) => ef.fieldName)
        )
      ),
    ];

    const columns = ["type", "id", ...ALL_KNOWN_FIELDS, ...allExtraFieldNames];

    return NextResponse.json({
      fileName: fileRecord.fileName,
      columns,
      rows,
      totalGem: gemTenders.length,
      totalNonGem: nonGemTenders.length,
    });
  } catch (error) {
    console.error("Tenders fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
