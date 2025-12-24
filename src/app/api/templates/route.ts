import { NextResponse } from "next/server";
import { getAvailableTemplates, getTemplateById } from "@/config/workflowTemplates";

/**
 * GET /api/templates
 * Returns list of available workflow templates (metadata only, no large JSON files)
 * 
 * Query params:
 * - id: (optional) Get specific template by ID
 * 
 * Response:
 * - Array of templates with { id, title, description, url, sizeInMB, thumbnail? }
 * - Client should fetch the actual JSON from the `url` field
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("id");

    // Get specific template by ID
    if (templateId) {
      const template = getTemplateById(templateId);
      if (!template) {
        return NextResponse.json(
          { success: false, error: "Template not found" },
          { status: 404 }
        );
      }

      if (!template.url) {
        return NextResponse.json(
          {
            success: false,
            error: "Template not yet uploaded to storage. See WORKFLOW_TEMPLATES_SETUP.md",
          },
          { status: 503 }
        );
      }

      return NextResponse.json({
        success: true,
        template,
      });
    }

    // Get all available templates
    const templates = getAvailableTemplates();

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error("Failed to get templates:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get templates",
      },
      { status: 500 }
    );
  }
}

