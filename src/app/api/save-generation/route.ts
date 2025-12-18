import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

// POST: Save a generated image to the generations folder
export async function POST(request: NextRequest) {
  try {
    const { directoryPath, image, prompt } = await request.json();

    if (!directoryPath || !image) {
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

    // Generate filename: timestamp + sanitized prompt snippet
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const promptSnippet = prompt
      ? prompt
          .slice(0, 30)
          .replace(/[^a-zA-Z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
          .toLowerCase()
      : "generation";
    const filename = `${timestamp}_${promptSnippet}.png`;
    const filePath = path.join(directoryPath, filename);

    // Extract base64 data and convert to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Write the image file
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      filePath,
      filename,
    });
  } catch (error) {
    console.error("Failed to save generation:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Save failed",
      },
      { status: 500 }
    );
  }
}
