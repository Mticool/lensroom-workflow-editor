# ✅ NanoBanana Edit с удобной загрузкой файлов

Добавлен file upload для NanoBanana Edit модели - теперь не нужно вручную вставлять URL.

---

## 📦 Что сделано

### 1. POST /api/upload endpoint
**Файл:** `src/app/api/upload/route.ts`

**Функционал:**
- ✅ Принимает `multipart/form-data` с полем `file`
- ✅ AUTH через `getUserId()` (поддерживает TEST_MODE)
- ✅ Валидация типов: `image/png`, `image/jpeg`, `image/webp`
- ✅ Валидация размера: максимум 10MB
- ✅ Загрузка в Supabase Storage bucket `"generations"`
- ✅ Путь: `${userId}/uploads/${randomUUID}_${fileName}`
- ✅ Возвращает `{ success: true, url: publicUrl, path }`
- ✅ Errors: 401 (unauthorized), 400 (invalid file), 500 (upload failed)

---

### 2. File Picker в LLMGenerateNode
**Файл:** `src/components/nodes/LLMGenerateNode.tsx`

**Обновления:**
- ✅ Показывает file picker ТОЛЬКО для `nano_banana_edit` модели
- ✅ Drag & drop зона с красивым UI
- ✅ Upload progress indicator
- ✅ Preview загруженного изображения
- ✅ Кнопка удаления загруженного файла
- ✅ Сохранение `imageUrl` и `uploadedFileName` в node data
- ✅ Error handling с отображением ошибок

---

### 3. Типы
**Файл:** `src/types/index.ts`

Добавлены поля в `LLMGenerateNodeData`:
```typescript
interface LLMGenerateNodeData {
  // ... existing fields
  imageUrl?: string;          // URL загруженного изображения
  uploadedFileName?: string;   // Имя файла для отображения
}
```

---

### 4. Workflow Store
**Файл:** `src/store/workflowStore.ts`

Обновлен `executeWorkflow`:
- ✅ Передает `imageUrl` из `nodeData` в `/api/infer`
- ✅ Работает для всех edit моделей

---

## 🎯 Как это работает

### Пользовательский flow:

1. **Создать LLM Generate ноду**
2. **Выбрать модель "Nano Banana Edit"**
3. **Появляется file picker "Изображение для редактирования"**
4. **Загрузить файл** (click или drag & drop)
   - Файл загружается на `/api/upload`
   - Возвращается public URL
   - Показывается превью
5. **Ввести промпт** (что изменить в изображении)
6. **Нажать "Запуск"**
7. **Получить отредактированное изображение!**

---

## 🧪 Как проверить

### 1. Запустить dev server
```bash
npm run dev
```

### 2. Создать workflow

1. Добавить **Prompt Node**
   - Ввести: `"Add a cute cat in the corner"`

2. Добавить **LLM Generate Node**
   - Выбрать модель: **Nano Banana Edit (Image)**
   - Загрузить изображение (click на upload зону)
   - Выбрать файл PNG/JPEG/WebP (макс 10MB)
   - Дождаться загрузки → увидите превью
   
3. Соединить **Prompt → LLM Generate**

4. Нажать **"Запуск"**

5. **Результат:**
   - LLM Generate нода покажет URL отредактированного изображения
   - Изображение сохранено в Supabase Storage
   - Credits списаны (8 кредитов)
   - Запись в `generations` table

---

## 📸 UI Preview

### До загрузки файла:
```
┌─────────────────────────────┐
│  🖼️  Изображение для         │
│     редактирования:         │
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │       📁              │  │
│  │   Нажмите для         │  │
│  │   загрузки            │  │
│  │                       │  │
│  │   PNG, JPEG, WebP     │  │
│  │   (макс 10MB)         │  │
│  │                       │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### После загрузки:
```
┌─────────────────────────────┐
│  🖼️  Изображение для         │
│     редактирования:         │
│                             │
│  ┌───────────────────────┐  │
│  │                    ❌ │  │
│  │   [  Preview Image  ] │  │
│  │                       │  │
│  │   my_image.png        │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

## 🔒 Безопасность

### Валидация файлов
- ✅ Только разрешенные MIME типы: `image/png`, `image/jpeg`, `image/webp`
- ✅ Максимальный размер: 10MB
- ✅ Имя файла sanitized (убраны опасные символы)

### Auth
- ✅ Требуется авторизация (userId)
- ✅ Поддерживает TEST_MODE для Vercel preview
- ✅ 401 если не авторизован

### Storage
- ✅ Файлы изолированы по userId: `${userId}/uploads/...`
- ✅ Уникальные имена файлов (UUID prefix)
- ✅ Public read access (для отображения в workflow)

---

## 📂 Измененные файлы

### Новые файлы (1)
1. **`src/app/api/upload/route.ts`** - Upload endpoint

### Обновленные файлы (3)
1. **`src/components/nodes/LLMGenerateNode.tsx`** - File picker UI
2. **`src/types/index.ts`** - Добавлены поля imageUrl, uploadedFileName
3. **`src/store/workflowStore.ts`** - Передача imageUrl в /api/infer

---

## 🎯 API Reference

### POST /api/upload

**Request:**
```typescript
FormData {
  file: File  // PNG, JPEG, or WebP (max 10MB)
}
```

**Response (Success):**
```json
{
  "success": true,
  "url": "https://xxxxx.supabase.co/storage/v1/object/public/generations/USER_ID/uploads/UUID_filename.png",
  "path": "USER_ID/uploads/UUID_filename.png"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid file (type/size)
- `401` - Unauthorized
- `500` - Upload failed

---

## 🔄 Integration с /api/infer

Workflow:
1. User uploads image → `/api/upload` → `imageUrl`
2. Node saves `imageUrl` in data
3. User clicks "Run" → `executeWorkflow()`
4. Store passes `imageUrl` to `/api/infer`
5. `/api/infer` validates: if `nano_banana_edit` → requires `imageUrl`
6. Kie.ai gets `image_urls: [imageUrl]`
7. Result → Supabase Storage → Public URL returned

---

## ✅ Checklist

- [x] ✅ POST /api/upload endpoint создан
- [x] ✅ Auth через getUserId (TEST_MODE support)
- [x] ✅ Валидация файлов (тип + размер)
- [x] ✅ Upload в Supabase Storage
- [x] ✅ File picker UI в LLMGenerateNode
- [x] ✅ Показывается ТОЛЬКО для nano_banana_edit
- [x] ✅ Preview загруженного изображения
- [x] ✅ Кнопка удаления
- [x] ✅ imageUrl передается в /api/infer
- [x] ✅ Типы обновлены
- [x] ✅ Error handling

---

## 🎉 Ready to Use!

**Test workflow:**
```
Prompt ("Add rainbows") → LLM Generate (NanoBanana + uploaded image) → Output
```

**Result:** Отредактированное изображение с радугами!

---

## 💡 Future Enhancements

**Потенциальные улучшения:**
- [ ] Preview в большем размере (modal)
- [ ] Поддержка drag & drop из других нод
- [ ] Crop/resize перед загрузкой
- [ ] История загруженных файлов
- [ ] Batch upload (несколько файлов)
- [ ] Поддержка video для будущих моделей

---

**Happy editing! 🎨**

