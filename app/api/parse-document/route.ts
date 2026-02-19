import { NextRequest } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer
) => Promise<{ text: string }>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx") as {
  read: (buffer: Buffer, opts: { type: string }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_csv: (sheet: unknown) => string;
  };
};

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "txt" || ext === "csv" || ext === "tsv") {
    const text = await file.text();
    return Response.json({ text, name: file.name });
  }

  if (ext === "pdf") {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdfParse(buffer);
      return Response.json({ text: data.text, name: file.name });
    } catch {
      return Response.json({ error: "Failed to parse PDF" }, { status: 422 });
    }
  }

  if (ext === "xlsx" || ext === "xls") {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      // Use the sheet name as a hint in the filename for the parser
      const csvName = file.name.replace(/\.(xlsx|xls)$/i, ".csv");
      return Response.json({ text: csv, name: csvName });
    } catch {
      return Response.json({ error: "Failed to parse Excel file" }, { status: 422 });
    }
  }

  return Response.json(
    { error: "Format non supporté. Utilisez PDF, TXT, CSV ou Excel (.xlsx)." },
    { status: 415 }
  );
}
