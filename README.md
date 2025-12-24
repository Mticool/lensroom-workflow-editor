# LensRoom Workflow Editor

> **Important note:** This is in early development and hasn't been tested off my machines, it probably has some issues. Use Chrome. 

LensRoom Workflow Editor is a node-based workflow application for creating and running AI pipelines. Build complex AI workflows by connecting nodes on a visual canvas. Originally forked from node-banana.

## Features

- **Visual Node Editor** - Drag-and-drop nodes onto an infinite canvas with pan and zoom
- **Image Annotation** - Full-screen editor with drawing tools (rectangles, circles, arrows, freehand, text)
- **AI Image Generation** - Generate images using Kie.ai models (Seedream, Midjourney, Veo, Kling)
- **Text Generation** - Generate text using LLM models
- **Workflow Chaining** - Connect multiple nodes to create complex pipelines
- **Save/Load Workflows** - Export and import workflows as JSON files
- **Model Registry** - Extensible system for adding new AI models and providers

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Node Editor**: @xyflow/react (React Flow)
- **Canvas**: Konva.js / react-konva
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **AI**: Kie.ai API (Seedream, Midjourney, Veo, Kling)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Kie.ai API Key (required for real inference)
# Get your API key from https://kie.ai/settings/api
KIE_API_KEY=your_kie_api_key_here

# Mock mode for development/testing (optional, defaults to false)
# When true: returns placeholder images without using real API credits
USE_MOCK_INFERENCE=false

# Anonymous inference (optional, for dev/testing only)
# Allows /api/infer without auth session - uses TEST_USER_ID
ALLOW_ANON_INFER=true
TEST_USER_ID=your-test-user-uuid-here
```

**Important:** API keys are NEVER exposed to the client. All AI inference requests are proxied through Next.js API routes (`/api/infer`).

### Mock vs Real Inference

#### 🎭 Mock Mode (Development)
Perfect for UI development and testing without consuming API credits:

```env
USE_MOCK_INFERENCE=true
# KIE_API_KEY not required in mock mode
```

- Returns placeholder images instantly
- No API credits consumed
- No internet connection to Kie.ai needed
- Great for testing UI/UX

#### 🚀 Real Mode (Production)
Uses actual Kie.ai Market API:

```env
KIE_API_KEY=your_real_api_key
USE_MOCK_INFERENCE=false  # or omit this line
```

- Generates real images using Kie.ai models
- Consumes API credits (8 credits per Seedream image)
- Requires valid API key from https://kie.ai
- Typical generation time: 10-30 seconds

**Getting an API Key:**
1. Go to https://kie.ai
2. Sign up or log in
3. Navigate to Settings → API
4. Generate a new API key
5. Add credits to your account

### Testing the API

After setting up your environment, test the endpoints:

```bash
# Get available models
curl http://localhost:3001/api/models

# Test inference in MOCK mode
curl -X POST http://localhost:3001/api/infer \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "seedream_image",
    "inputs": { "prompt": "a beautiful sunset over mountains" },
    "params": {}
  }'

# Response (mock):
# {
#   "success": true,
#   "urls": ["https://via.placeholder.com/1024x1024.png?text=Mock+seedream_image"],
#   "meta": { "modelId": "seedream_image", "mock": true }
# }

# With REAL API (requires valid KIE_API_KEY):
# {
#   "success": true,
#   "urls": ["https://kie-api-uploads.s3.amazonaws.com/..."],
#   "meta": { "taskId": "abc123", "modelId": "seedream_image", "duration": 15234 }
# }
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm run start
```

## Example Workflows

The `/examples` directory contains some example workflow files from my personal projects. To try them:

1. Start the dev server with `npm run dev`
2. Drag any `.json` file from the `/examples` folder into the browser window
3. Make sure you review each of the prompts before starting, these are fairly targetted to the examples. 

## Usage

1. **Add nodes** - Click the floating action bar to add nodes to the canvas
2. **Connect nodes** - Drag from output handles to input handles (matching types only)
3. **Configure nodes** - Adjust settings like model, aspect ratio, or drawing tools
4. **Run workflow** - Click the Run button to execute the pipeline
5. **Save/Load** - Use the header menu to save or load workflows

## Connection Rules

- **Image** handles connect to **Image** handles only
- **Text** handles connect to **Text** handles only
- Image inputs on generation nodes accept multiple connections
- Text inputs accept single connections

## API Endpoints

### GET /api/models

Returns a list of available AI models that can be used in the workflow.

```bash
curl http://localhost:3001/api/models
```

Response:
```json
[
  {
    "id": "seedream_image",
    "title": "Seedream (Image)",
    "provider": "kie",
    "capability": "image",
    "enabled": true,
    "creditCost": 8,
    "paramsSchema": {
      "width": { "type": "number", "default": 1024 },
      "height": { "type": "number", "default": 1024 }
    }
  }
]
```

### POST /api/infer

**Production-ready** inference endpoint with:
- ✅ Authentication (lr_session JWT)
- ✅ Credit system integration
- ✅ Supabase Storage upload
- ✅ Generations tracking
- ✅ Rate limiting (30 req/5min per user)

```bash
curl -X POST http://localhost:3001/api/infer \
  -H "Content-Type: application/json" \
  -H "Cookie: lr_session=YOUR_SESSION_TOKEN" \
  -d '{
    "modelId": "seedream_image",
    "inputs": { "prompt": "a beautiful sunset" },
    "params": {}
  }'
```

Response:
```json
{
  "success": true,
  "urls": ["https://your-project.supabase.co/storage/v1/object/public/generations/..."],
  "meta": {
    "modelId": "seedream_image",
    "generationId": "uuid-here",
    "taskId": "kie-task-id",
    "duration": 12345
  },
  "newBalance": 92
}
```

Error responses:
- `401` - Unauthorized (no session)
- `402` - Insufficient credits
- `429` - Rate limit exceeded
- `500` - Server error

**Setup:** See [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) for database schema and configuration.

## License

MIT

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for attributions.
