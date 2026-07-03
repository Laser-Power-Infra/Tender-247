import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const dateStr = request.nextUrl.searchParams.get("date");
    if (!dateStr) {
      return NextResponse.json(
        { error: "date query parameter is required (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    // const files = await prisma.$queryRaw<any[]>`
    //   SELECT
    //     id,
    //     "fileName",
    //     "filePath",
    //     "fileType",
    //     "fileSize",
    //     "uploadedBy",
    //     status,
    //     "totalCount",
    //     "excludedCount",
    //     "createdAt",
    //     "updatedAt"
    //   FROM files
    //   WHERE DATE(created_at) = ${dateStr}::date
    //   ORDER BY created_at DESC
    // `;
    console.log(dateStr);
    const start = new Date(`${dateStr}T00:00:00.000`);
    const end = new Date(`${dateStr}T23:59:59.999`);

    const files = await prisma.file.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Files fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
