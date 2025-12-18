import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

// POST: Save workflow to file
export async function POST(request: NextRequest) {
  try {
    const { directoryPath, filename, workflow } = await request.json();

    if (!directoryPath || !filename || !workflow) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate directory exists
    try {
      const stats = await fs.stat(directoryPath);
      if (!stats.isDirectory()) {
        return NextResponse.json(
          { success: false, error: "Path is not a directory" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Directory does not exist" },
        { status: 400 }
      );
    }

    // Sanitize filename (remove special chars, ensure .json extension)
    const safeName = filename.replace(/[^a-zA-Z0-9-_]/g, "_");
    const filePath = path.join(directoryPath, `${safeName}.json`);

    // Write workflow JSON
    const json = JSON.stringify(workflow, null, 2);
    await fs.writeFile(filePath, json, "utf-8");

    return NextResponse.json({
      success: true,
      filePath,
    });
  } catch (error) {
    console.error("Failed to save workflow:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Save failed",
      },
      { status: 500 }
    );
  }
}

// GET: Validate directory path
export async function GET(request: NextRequest) {
  const directoryPath = request.nextUrl.searchParams.get("path");

  if (!directoryPath) {
    return NextResponse.json(
      { success: false, error: "Path parameter required" },
      { status: 400 }
    );
  }

  try {
    const stats = await fs.stat(directoryPath);
    return NextResponse.json({
      success: true,
      exists: true,
      isDirectory: stats.isDirectory(),
    });
  } catch {
    return NextResponse.json({
      success: true,
      exists: false,
      isDirectory: false,
    });
  }
}
