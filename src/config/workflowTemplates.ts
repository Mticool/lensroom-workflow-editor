/**
 * Workflow Templates Registry
 * 
 * Large template files are excluded from Vercel deployment.
 * To use templates:
 * 1. Upload JSON files to Supabase Storage bucket: "workflow-templates"
 * 2. Make the bucket public (or use signed URLs)
 * 3. Update the `url` field below with the public Supabase URL
 * 
 * Example Supabase URL format:
 * https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/contact-sheet-tim.json
 */

export interface WorkflowTemplate {
  id: string;
  title: string;
  description: string;
  /**
   * URL to the template JSON file.
   * Can be:
   * - Supabase Storage public URL (recommended for large files)
   * - /templates/filename.json (for small files in /public/templates/)
   */
  url: string;
  /**
   * File size in MB (approximate)
   */
  sizeInMB: number;
  /**
   * Preview thumbnail URL (optional)
   */
  thumbnail?: string;
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "contact-sheet-tim",
    title: "Contact Sheet - Tim",
    description: "Professional contact sheet workflow with Tim's photography portfolio",
    url: "", // TODO: Upload to Supabase and add URL here
    sizeInMB: 56,
  },
  {
    id: "contact-sheet-jpow",
    title: "Contact Sheet - JPow",
    description: "Contact sheet workflow featuring JPow's portfolio",
    url: "", // TODO: Upload to Supabase and add URL here
    sizeInMB: 52,
  },
  {
    id: "contact-sheet-billsSupra",
    title: "Contact Sheet - Bill's Supra",
    description: "Automotive photography contact sheet for Bill's Supra project",
    url: "", // TODO: Upload to Supabase and add URL here
    sizeInMB: 79,
  },
  {
    id: "contact-sheet-ChrisWalkman",
    title: "Contact Sheet - Chris Walkman",
    description: "Professional photography workflow from Chris Walkman's collection",
    url: "", // TODO: Upload to Supabase and add URL here
    sizeInMB: 82,
  },
];

/**
 * Get all available workflow templates
 * Filters out templates without URLs (not yet uploaded)
 * In production, returns empty array (large templates are not bundled)
 */
export function getAvailableTemplates(): WorkflowTemplate[] {
  // In production, never include large templates to avoid bundle size issues
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  
  // In development, return templates with valid URLs only
  return workflowTemplates.filter((t) => t.url && t.url.length > 0);
}

/**
 * Get a specific template by ID
 * In production, always returns undefined (large templates are not bundled)
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  // In production, never return templates to avoid bundle size issues
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }
  
  return workflowTemplates.find((t) => t.id === id);
}

