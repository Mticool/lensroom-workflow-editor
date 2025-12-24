# ✅ Vercel Deployment Ready!

LensRoom Workflow Editor готов к деплою на Vercel с реальной генерацией через Kie.ai.

---

## 📦 Что реализовано

### ✅ 3 AI модели (Kie.ai)

1. **Seedream** (Image Generation)
   - Provider: Kie Market API
   - Cost: 8 credits
   - Input: prompt + image_size

2. **Nano Banana Edit** (Image Editing)
   - Provider: Kie Market API
   - Cost: 8 credits
   - Input: prompt + imageUrl + image_size

3. **Veo 3.1** (Video Generation)
   - Provider: Kie Veo API
   - Cost: 25 credits
   - Input: prompt + aspectRatio

### ✅ TEST_MODE для Vercel

- `TEST_MODE=true` → использует `TEST_USER_ID` (bypass auth)
- Идеально для preview deployments без настройки auth

### ✅ MOCK_INFERENCE для разработки

- `USE_MOCK_INFERENCE=true` → возвращает фейк URLs
- Не списывает кредиты, не пишет в БД
- Быстрое тестирование UI

### ✅ Полная интеграция

- ✅ Kie.ai Market API (Seedream, NanoBanana)
- ✅ Kie.ai Veo API (Veo 3.1)
- ✅ Supabase credits system
- ✅ Supabase generations tracking
- ✅ Supabase Storage (images + videos)
- ✅ Atomic credit operations
- ✅ Error handling
- ✅ Smoke test

---

## 📂 Измененные файлы

### Новые файлы (2)
1. **`ENV_VARIABLES.md`** - Документация ENV переменных
2. **`scripts/smoke.ts`** - Smoke test для Vercel readiness

### Обновленные файлы (4)
1. **`src/lib/auth/getUserId.ts`** - Добавлен TEST_MODE
2. **`src/lib/kie/client.ts`** - Market + Veo API support
3. **`src/config/modelRegistry.ts`** - 3 модели (enabled=true)
4. **`src/app/api/infer/route.ts`** - Поддержка всех 3 моделей

### package.json
- Добавлен script: `"smoke": "tsx scripts/smoke.ts"`

---

## 🚀 Команды

### Local Development

```bash
# Запустить dev server
npm run dev

# Smoke test (проверка готовности)
npm run smoke
```

### Проверка интеграции

```bash
# Проверить контракт интеграции
npm run verify:integration
```

---

## ⚙️ Environment Variables

### Обязательные

```env
KIE_API_KEY=your_kie_api_key
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Опциональные (для тестирования)

```env
# Test Mode (для Vercel preview)
TEST_MODE=true
TEST_USER_ID=your-test-user-uuid

# Mock Mode (для разработки)
USE_MOCK_INFERENCE=false
```

**См. `ENV_VARIABLES.md` для деталей**

---

## 🧪 Smoke Test

### Что проверяет

1. ✅ ENV переменные установлены
2. ✅ `/api/models` возвращает модели
3. ✅ `/api/infer` работает в mock режиме
4. ✅ `/api/infer` работает в real режиме (если TEST_MODE=true)

### Запуск

```bash
# Запустить dev server
npm run dev

# В другом терминале
npm run smoke
```

### Ожидаемый вывод

```
═══════════════════════════════════════════════════════════════════
  Smoke Test - Vercel Deployment Readiness
═══════════════════════════════════════════════════════════════════

ℹ️  Step 1: Checking environment variables...

✅ KIE_API_KEY is set
✅ NEXT_PUBLIC_SUPABASE_URL is set
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY is set
✅ SUPABASE_SERVICE_ROLE_KEY is set
✅ TEST_USER_ID is set: xxx-xxx-xxx
✅ TEST_USER_ID is valid UUID

ℹ️  Step 2: Testing /api/models...

✅ /api/models returned 3 models
✅   ✓ seedream_image is enabled
✅   ✓ nano_banana_edit is enabled
✅   ✓ veo3_video is enabled

ℹ️  Step 3: Testing /api/infer (MOCK mode)...

✅ /api/infer (mock) returned URL: https://placehold.co/1024x1024/png
✅   ✓ Mock mode confirmed

ℹ️  Step 4: Testing /api/infer (REAL mode with TEST_USER_ID)...
⏳ This will take ~10-20 seconds (real Kie.ai call)...

✅ /api/infer (real) returned URL: https://...supabase.co/storage/.../photo/xxx.png
✅   ✓ Generation ID: xxx
✅   ✓ Task ID: xxx
✅   ✓ Duration: 9500ms
✅   ✓ New balance: 92

═══════════════════════════════════════════════════════════════════
  ✅ ALL TESTS PASSED!
═══════════════════════════════════════════════════════════════════

✅ App is ready for Vercel deployment! 🚀
```

---

## 📋 Vercel Deployment Steps

### 1. Подготовка

```bash
# Commit changes
git add .
git commit -m "feat: Add Kie.ai integration with 3 models"
git push
```

### 2. Vercel Dashboard

1. Импортировать проект в Vercel
2. Настроить Environment Variables

### 3. Environment Variables (Production)

```
KIE_API_KEY=prod_key
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod_anon_key
SUPABASE_SERVICE_ROLE_KEY=prod_service_role_key
TEST_MODE=false
USE_MOCK_INFERENCE=false
```

### 4. Environment Variables (Preview)

```
KIE_API_KEY=dev_key
NEXT_PUBLIC_SUPABASE_URL=https://dev.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dev_anon_key
SUPABASE_SERVICE_ROLE_KEY=dev_service_role_key
TEST_MODE=true
TEST_USER_ID=your-test-user-uuid
USE_MOCK_INFERENCE=false
```

### 5. Deploy

Vercel автоматически задеплоит при push в main/master.

Preview deployments создаются для каждого PR.

---

## 🔍 Troubleshooting

### "KIE_API_KEY missing"

Добавьте в Vercel Environment Variables

### "Unauthorized" в TEST_MODE

1. Проверьте `TEST_MODE=true` в ENV
2. Проверьте `TEST_USER_ID` - валидный UUID
3. Проверьте user exists in DB:
   ```sql
   SELECT * FROM public.credits WHERE user_id = 'your-uuid';
   ```

### "Insufficient credits"

Добавьте кредиты test user:
```sql
UPDATE public.credits SET amount = 1000 WHERE user_id = 'your-test-uuid';
```

### Smoke test fails

1. Убедитесь dev server запущен: `npm run dev`
2. Проверьте все ENV переменные установлены
3. Проверьте порт 3000 свободен

---

## 🎯 API Reference

### GET /api/models

**Response:**
```json
[
  {
    "id": "seedream_image",
    "title": "Seedream (Image)",
    "provider": "kie-market",
    "capability": "image",
    "enabled": true,
    "creditCost": 8,
    "paramsSchema": { ... }
  },
  ...
]
```

---

### POST /api/infer

**Request:**
```json
{
  "modelId": "seedream_image",
  "inputs": {
    "prompt": "a cute robot"
  },
  "params": {
    "image_size": "square_hd"
  }
}
```

**Response:**
```json
{
  "success": true,
  "urls": ["https://...supabase.co/storage/.../photo/xxx.png"],
  "meta": {
    "modelId": "seedream_image",
    "generationId": "uuid",
    "taskId": "kie-task-id",
    "duration": 9500
  },
  "newBalance": 92
}
```

---

## 📊 Supported Models

| Model ID | Title | Type | Cost | Provider |
|----------|-------|------|------|----------|
| `seedream_image` | Seedream | Image | 8 | Kie Market |
| `nano_banana_edit` | Nano Banana Edit | Edit | 8 | Kie Market |
| `veo3_video` | Veo 3.1 | Video | 25 | Kie Veo |

---

## ✅ Checklist

Перед деплоем:

- [x] ✅ Все модели работают локально
- [x] ✅ Smoke test проходит
- [x] ✅ Integration contract соблюдается
- [x] ✅ ENV переменные документированы
- [x] ✅ TEST_MODE работает
- [x] ✅ MOCK_INFERENCE работает
- [x] ✅ Credits списываются
- [x] ✅ Generations сохраняются
- [x] ✅ Storage uploads работают
- [x] ✅ Error handling реализован

---

## 🎉 Ready for Production!

**Команды для быстрого старта:**

```bash
# Local development
npm run dev
npm run smoke

# Проверка интеграции
npm run verify:integration

# Deploy
git push
```

**Happy deploying! 🚀**
