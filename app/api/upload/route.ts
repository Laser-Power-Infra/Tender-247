import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import {
  GEM_FIELDS,
  NON_GEM_FIELDS,
  mapRowToTender,
  hasReferenceNoColumn,
  getReferenceNo,
  isGemReference,
  parseDate,
  getFieldValue,
} from "@/lib/tender-columns";

const SHEET_CONCURRENCY = 3;
const INSERT_BATCH_SIZE = 50;
const TX_TIMEOUT = 10 * 60 * 1000;

interface SheetResult {
  sheetName: string;
  gemCount: number;
  nonGemCount: number;
  excludedCount: number;
  errors: string[];
  skipped: boolean;
}

interface FileResult {
  fileName: string;
  fileId: number;
  sheets: SheetResult[];
  totalGem: number;
  totalNonGem: number;
  totalErrors: string[];
  totalCount: number;
  excludedCount: number;
}

interface PreparedTender {
  refNo: string;
  createData: Record<string, unknown>;
}

interface ParsedSheet {
  sheetName: string;
  gemPrepared: PreparedTender[];
  nonGemPrepared: PreparedTender[];
  skipped: boolean;
  excludedCount: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function buildCreateData(
  row: Record<string, unknown>,
  headers: string[],
  fileId: number,
  knownFieldSet: Set<string>
): { refNo: string; createData: Record<string, unknown> } {
  const refNo = getReferenceNo(row, headers) || "";
  const { knownFields, extraFields } = mapRowToTender(row, knownFieldSet);

  const createData: Record<string, unknown> = {
    fileId,
    referenceNo: refNo,
  };

  for (const [key, value] of Object.entries(knownFields)) {
    if (key !== "referenceNo") {
      createData[key] = value;
    }
  }

  if (extraFields.length) {
    createData.extraFields = {
      create: extraFields,
    };
  }

  return { refNo, createData };
}

function parseSheetData(
  workbook: XLSX.WorkBook,
  sheetName: string,
  keywords: string[],
  today: Date
): ParsedSheet {
  const sheet = workbook.Sheets[sheetName];
  const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });

  if (!jsonData.length) {
    return { sheetName, gemPrepared: [], nonGemPrepared: [], skipped: true, excludedCount: 0 };
  }

  const headers = Object.keys(jsonData[0]);

  if (!hasReferenceNoColumn(headers)) {
    return { sheetName, gemPrepared: [], nonGemPrepared: [], skipped: true, excludedCount: 0 };
  }

  const gemPrepared: PreparedTender[] = [];
  const nonGemPrepared: PreparedTender[] = [];
  let excludedCount = 0;

  for (const row of jsonData) {
    const refNo = getReferenceNo(row, headers);
    if (!refNo) continue;

    const tenderBrief = getFieldValue(row, headers, "tenderBrief");
    const briefText =
      tenderBrief == null ? "" : String(tenderBrief).toLowerCase();
    const isKeywordExcluded =
      briefText.length > 0 &&
      keywords.some((kw) => briefText.includes(kw));

    const deadlineRaw = getFieldValue(row, headers, "deadline");
    const deadlineDate = deadlineRaw ? parseDate(deadlineRaw) : null;
    const isDateExcluded =
      deadlineDate !== null && deadlineDate.getTime() <= today.getTime();

    if (isKeywordExcluded || isDateExcluded) {
      excludedCount++;
      continue;
    }

    if (isGemReference(refNo)) {
      const { refNo: r, createData } = buildCreateData(
        row,
        headers,
        0,
        GEM_FIELDS
      );
      gemPrepared.push({ refNo: r, createData });
    } else {
      const { refNo: r, createData } = buildCreateData(
        row,
        headers,
        0,
        NON_GEM_FIELDS
      );
      nonGemPrepared.push({ refNo: r, createData });
    }
  }

  return {
    sheetName,
    gemPrepared,
    nonGemPrepared,
    skipped: false,
    excludedCount,
  };
}

async function insertGemPrepared(
  prepared: PreparedTender[],
  fileId: number,
  sheetResult: SheetResult
): Promise<void> {
  if (!prepared.length) return;

  const batches = chunk(prepared, INSERT_BATCH_SIZE);

  for (const batch of batches) {
    try {
      await prisma.$transaction(
        batch.map((r) => {
          const data = { ...r.createData, fileId };
          return prisma.gemTender.create({ data: data as any });
        }),
        { timeout: TX_TIMEOUT }
      );
      sheetResult.gemCount += batch.length;
    } catch {
      for (const row of batch) {
        try {
          const data = { ...row.createData, fileId };
          await prisma.gemTender.create({ data: data as any });
          sheetResult.gemCount++;
        } catch (err) {
          sheetResult.errors.push(
            `Gem row ${row.refNo || "unknown"}: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }
    }
  }
}

async function insertNonGemPrepared(
  prepared: PreparedTender[],
  fileId: number,
  sheetResult: SheetResult
): Promise<void> {
  if (!prepared.length) return;

  const batches = chunk(prepared, INSERT_BATCH_SIZE);

  for (const batch of batches) {
    try {
      await prisma.$transaction(
        batch.map((r) => {
          const data = { ...r.createData, fileId };
          return prisma.nonGemTender.create({ data: data as any });
        }),
        { timeout: TX_TIMEOUT }
      );
      sheetResult.nonGemCount += batch.length;
    } catch {
      for (const row of batch) {
        try {
          const data = { ...row.createData, fileId };
          await prisma.nonGemTender.create({ data: data as any });
          sheetResult.nonGemCount++;
        } catch (err) {
          sheetResult.errors.push(
            `Non-gem row ${row.refNo || "unknown"}: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const results: FileResult[] = [];

    for (const file of files) {
      const fileResult = await processFile(file);
      results.push(fileResult);
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

async function processFile(file: File): Promise<FileResult> {
  const fileResult: FileResult = {
    fileName: file.name,
    fileId: 0,
    sheets: [],
    totalGem: 0,
    totalNonGem: 0,
    totalErrors: [],
    totalCount: 0,
    excludedCount: 0,
  };

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const keywordRows = await prisma.exlusionKeywords.findMany();
  const keywords = [
    ...new Set(
      keywordRows.flatMap((r) =>
        (r.keywords || "")
          .split(",")
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
      )
    ),
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fileRecord = await prisma.file.create({
    data: {
      fileName: file.name,
      fileType:
        file.type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSize: file.size,
      status: "processing",
    },
  });
  fileResult.fileId = fileRecord.id;

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const limit = pLimit(SHEET_CONCURRENCY);

  const sheetTasks = workbook.SheetNames.map((sheetName) =>
    limit(async () => {
      const parsed = parseSheetData(workbook, sheetName, keywords, today);

      const sheetResult: SheetResult = {
        sheetName: parsed.sheetName,
        gemCount: 0,
        nonGemCount: 0,
        excludedCount: parsed.excludedCount,
        errors: [],
        skipped: parsed.skipped,
      };

      if (parsed.skipped) return sheetResult;

      await Promise.all([
        insertGemPrepared(parsed.gemPrepared, fileRecord.id, sheetResult),
        insertNonGemPrepared(parsed.nonGemPrepared, fileRecord.id, sheetResult),
      ]);

      return sheetResult;
    })
  );

  const sheetResults = await Promise.all(sheetTasks);
  fileResult.sheets = sheetResults;

  for (const s of sheetResults) {
    fileResult.totalGem += s.gemCount;
    fileResult.totalNonGem += s.nonGemCount;
    fileResult.excludedCount += s.excludedCount;
    fileResult.totalErrors.push(...s.errors);
  }
  fileResult.totalCount = fileResult.totalGem + fileResult.totalNonGem + fileResult.excludedCount;

  await prisma.file.update({
    where: { id: fileRecord.id },
    data: {
      status: fileResult.totalErrors.length
        ? "completed_with_errors"
        : "completed",
      totalCount: fileResult.totalCount,
      excludedCount: fileResult.excludedCount,
    },
  });

  return fileResult;
}
