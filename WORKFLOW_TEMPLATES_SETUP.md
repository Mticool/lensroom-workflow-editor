# Workflow Templates Setup

## 🚨 Why Templates Are Not Included in Deployment

The workflow template files (`examples/contact-sheet-*.json`) are **269MB total** and exceed Vercel's 250MB deployment limit. These files are:

- `contact-sheet-ChrisWalkman.json` - 82MB
- `contact-sheet-billsSupra.json` - 79MB
- `contact-sheet-tim.json` - 56MB
- `contact-sheet-jpow.json` - 52MB

**Solution:** Upload these files to Supabase Storage and configure URLs in the templates registry.

---

## 📦 Setup Instructions

### Step 1: Create Supabase Storage Bucket

1. Go to your Supabase project: https://supabase.com/dashboard/project/hujjvnubkoyxmmfrnllv
2. Navigate to **Storage** → **Buckets**
3. Click **New bucket**
   - Name: `workflow-templates`
   - Public bucket: ✅ **Yes** (or use signed URLs for private access)
   - File size limit: 100MB per file (adjust if needed)
4. Click **Create bucket**

### Step 2: Upload Template Files

#### Option A: Via Supabase Dashboard (Recommended for small files)

1. Go to Storage → `workflow-templates` bucket
2. Click **Upload file**
3. Upload each JSON file from `examples/`:
   - `contact-sheet-tim.json`
   - `contact-sheet-jpow.json`
   - `contact-sheet-billsSupra.json`
   - `contact-sheet-ChrisWalkman.json`

#### Option B: Via Supabase CLI (Recommended for large files)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref hujjvnubkoyxmmfrnllv

# Upload files
supabase storage upload workflow-templates examples/contact-sheet-tim.json
supabase storage upload workflow-templates examples/contact-sheet-jpow.json
supabase storage upload workflow-templates examples/contact-sheet-billsSupra.json
supabase storage upload workflow-templates examples/contact-sheet-ChrisWalkman.json
```

#### Option C: Via REST API

```bash
# Set your Supabase service role key
export SUPABASE_KEY="your_service_role_key"

# Upload using curl
curl -X POST \
  "https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/workflow-templates/contact-sheet-tim.json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @examples/contact-sheet-tim.json
```

### Step 3: Get Public URLs

After uploading, get the public URL for each file:

**Format:**
```
https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/<filename>
```

**Example URLs:**
- `https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/contact-sheet-tim.json`
- `https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/contact-sheet-jpow.json`
- `https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/contact-sheet-billsSupra.json`
- `https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/contact-sheet-ChrisWalkman.json`

### Step 4: Update Templates Registry

Edit `src/config/workflowTemplates.ts` and add the Supabase URLs:

```typescript
export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "contact-sheet-tim",
    title: "Contact Sheet - Tim",
    description: "Professional contact sheet workflow with Tim's photography portfolio",
    url: "https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/contact-sheet-tim.json",
    sizeInMB: 56,
  },
  {
    id: "contact-sheet-jpow",
    title: "Contact Sheet - JPow",
    description: "Contact sheet workflow featuring JPow's portfolio",
    url: "https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/contact-sheet-jpow.json",
    sizeInMB: 52,
  },
  {
    id: "contact-sheet-billsSupra",
    title: "Contact Sheet - Bill's Supra",
    description: "Automotive photography contact sheet for Bill's Supra project",
    url: "https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/contact-sheet-billsSupra.json",
    sizeInMB: 79,
  },
  {
    id: "contact-sheet-ChrisWalkman",
    title: "Contact Sheet - Chris Walkman",
    description: "Professional photography workflow from Chris Walkman's collection",
    url: "https://hujjvnubkoyxmmfrnllv.supabase.co/storage/v1/object/public/workflow-templates/contact-sheet-ChrisWalkman.json",
    sizeInMB: 82,
  },
];
```

### Step 5: Test the API

```bash
# Get all available templates
curl http://localhost:3000/api/templates

# Get specific template
curl http://localhost:3000/api/templates?id=contact-sheet-tim
```

---

## 🔧 Usage in Client Code

### Fetch and Load Template

```typescript
// Get all templates
const response = await fetch('/api/templates');
const { templates } = await response.json();

// Load specific template
async function loadTemplate(templateId: string) {
  // 1. Get template metadata
  const metaResponse = await fetch(`/api/templates?id=${templateId}`);
  const { template } = await metaResponse.json();
  
  // 2. Fetch the actual workflow JSON from Supabase
  const workflowResponse = await fetch(template.url);
  const workflow = await workflowResponse.json();
  
  // 3. Load into workflow store
  loadWorkflow(workflow);
}
```

---

## 📊 Monitoring

### Check Storage Usage

1. Go to Supabase Dashboard → **Storage** → `workflow-templates`
2. View file sizes and download counts
3. Monitor bandwidth usage in **Settings** → **Usage**

### Storage Limits

- **Free tier:** 1GB storage, 2GB bandwidth/month
- **Pro tier:** 100GB storage, 200GB bandwidth/month
- **Pay as you go:** Additional storage/bandwidth charged separately

---

## 🔐 Security Options

### Option 1: Public Bucket (Current)
- ✅ Easy to set up
- ✅ Fast access (CDN)
- ⚠️ Anyone with URL can download

### Option 2: Private Bucket with Signed URLs
1. Make bucket private
2. Generate signed URLs server-side:

```typescript
// src/app/api/templates/route.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Generate signed URL (expires in 1 hour)
const { data } = await supabase.storage
  .from('workflow-templates')
  .createSignedUrl('contact-sheet-tim.json', 3600);

return NextResponse.json({ url: data.signedUrl });
```

---

## ❓ Troubleshooting

### "Template not found" Error
- Check that file is uploaded to Supabase Storage
- Verify bucket name is `workflow-templates`
- Ensure URLs in `workflowTemplates.ts` are correct

### "403 Forbidden" Error
- Verify bucket is public (or use signed URLs)
- Check Storage policies in Supabase Dashboard

### Large File Upload Fails
- Use Supabase CLI instead of Dashboard for files >100MB
- Increase bucket file size limit in Settings

---

## 📝 Notes

- Template files are **excluded from Git** via `.gitignore` to keep repo size small
- Template files are **excluded from Vercel** via `.vercelignore` to stay under 250MB limit
- Client fetches templates **on-demand** from Supabase (not bundled in deployment)
- Consider adding template thumbnails/previews in future updates

