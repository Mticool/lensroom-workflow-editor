# ✅ Auto-генерация промптов для Split Grid через Anthropic

Split Grid теперь автоматически генерирует N уникальных вариантов промпта через Anthropic, если пользователь ввёл только один базовый промпт.

---

## 📦 Что сделано

### 1. Helper функция ✅

**Файл:** `src/lib/llm/generatePromptVariants.ts`

**Функция:**
```typescript
async function generatePromptVariants(
  basePrompt: string,
  n: number
): Promise<string[]>
```

**Логика:**
1. **Валидация:** Проверка basePrompt и n
2. **Оптимизация:** Если n=1, сразу возвращает базовый промпт
3. **Anthropic API:**
   - Model: `claude-3-5-sonnet-20241022` (или из `ANTHROPIC_MODEL`)
   - Temperature: `0.9` (высокая креативность)
   - Max tokens: `2000`
   - System prompt: "You are a creative AI prompt engineer"
   - User prompt: "Generate N unique variations..."

4. **Парсинг:**
   - **Основной:** JSON.parse массива строк
   - **Fallback:** Извлечение строк построчно (если JSON не распарсился)

5. **Гарантия длины:**
   - **Меньше N:** Добавляет `"${basePrompt} (variant X)"`
   - **Больше N:** Обрезает до N

6. **Error handling:**
   - При ошибке возвращает fallback: базовый промпт N раз с суффиксами

**Пример работы:**
```typescript
// Input
await generatePromptVariants("a cat sitting on a chair", 3);

// Output
[
  "a tabby cat lounging on a vintage wooden chair",
  "a fluffy persian cat perched on a modern office chair",
  "a sleek black cat curled up on a cozy armchair"
]
```

---

### 2. SplitGridSettingsModal обновлен ✅

**Файл:** `src/components/SplitGridSettingsModal.tsx`

**Изменения:**

#### State добавлен:
```typescript
const [isGenerating, setIsGenerating] = useState(false);
const [generateError, setGenerateError] = useState<string | null>(null);
```

#### handleCreate стал async:
```typescript
const handleCreate = useCallback(async () => {
  setIsGenerating(true);
  setGenerateError(null);

  // Generate prompt variants
  let promptVariants: string[];
  
  try {
    if (defaultPrompt && defaultPrompt.trim().length > 0) {
      promptVariants = await generatePromptVariants(
        defaultPrompt.trim(),
        targetCount
      );
    } else {
      promptVariants = Array.from({ length: targetCount }, () => "");
    }
  } catch (error) {
    setGenerateError("Не удалось сгенерировать варианты...");
    promptVariants = Array.from({ length: targetCount }, () => defaultPrompt);
  }

  // Create nodes with generated variants
  for (let i = 0; i < targetCount; i++) {
    // ...
    const promptText = promptVariants[i] || defaultPrompt;
    updateNodeData(promptId, { prompt: promptText });
  }

  setIsGenerating(false);
  onClose();
}, [...]);
```

**Поведение:**
- ✅ Если `defaultPrompt` заполнен → генерирует N вариантов через Anthropic
- ✅ Если `defaultPrompt` пустой → создает пустые промпты
- ✅ При ошибке → использует базовый промпт для всех + показывает предупреждение

---

### 3. UI индикатор добавлен ✅

**Компоненты:**

#### Индикатор генерации:
```jsx
{isGenerating && (
  <div className="flex items-center gap-2 text-sm text-blue-400">
    <svg className="w-4 h-4 animate-spin">...</svg>
    <span>Генерируем варианты промпта…</span>
  </div>
)}
```

#### Индикатор ошибки:
```jsx
{generateError && (
  <div className="flex items-center gap-2 text-sm text-yellow-400">
    <svg className="w-4 h-4">⚠️</svg>
    <span>{generateError}</span>
  </div>
)}
```

#### Кнопка с состоянием:
```jsx
<button
  onClick={handleCreate}
  disabled={isGenerating}
  className="...disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isGenerating ? (
    <span className="flex items-center gap-2">
      <svg className="animate-spin">...</svg>
      Генерация...
    </span>
  ) : (
    `Создать ${targetCount} наборов генерации`
  )}
</button>
```

**Визуально:**
- 🔵 **Генерация:** Синий индикатор с spinner + disabled кнопки
- ⚠️ **Ошибка:** Желтый индикатор с предупреждением (3 секунды)
- ✅ **Успех:** Модал закрывается, ноды создаются

---

## 🎯 Как работает

### Пользовательский flow:

1. **Создать Split Grid Node**

2. **Дважды кликнуть → откроется модал**

3. **Выбрать количество:** 6 изображений

4. **Ввести базовый промпт:**
   ```
   "a futuristic cityscape"
   ```

5. **Нажать "Создать 6 наборов генерации"**

6. **Процесс:**
   - ⏳ Индикатор: "Генерируем варианты промпта…"
   - 🤖 Вызов Anthropic API (~2-5 секунд)
   - ✅ Создание 6 нод с разными промптами

7. **Результат:**
   ```
   Prompt 1: "a neon-lit futuristic cityscape at night"
   Prompt 2: "a sprawling futuristic cityscape with flying cars"
   Prompt 3: "a minimalist futuristic cityscape with glass towers"
   Prompt 4: "a dystopian futuristic cityscape in heavy rain"
   Prompt 5: "a utopian futuristic cityscape with green spaces"
   Prompt 6: "a cyberpunk futuristic cityscape with holograms"
   ```

---

## 🧪 Тестирование

### 1. Базовый тест (6 промптов)

**Шаги:**
1. Создать Split Grid Node
2. Двойной клик → модал
3. Выбрать: **6 изображений**
4. Ввести базовый промпт:
   ```
   a robot in a garden
   ```
5. Нажать "Создать 6 наборов генерации"

**Ожидаемый результат:**
- ⏳ Индикатор "Генерируем варианты промпта…"
- ✅ Через 2-5 секунд: 6 prompt нод с разными вариантами
- Каждая нода имеет уникальный текст

**Примеры вариантов:**
```
1. "a sleek metallic robot tending flowers in a lush garden"
2. "a vintage steampunk robot watering plants in a cottage garden"
3. "a friendly robot playing with butterflies in a zen garden"
4. "a futuristic robot pruning roses in a modern rooftop garden"
5. "a rusty old robot resting among wildflowers in an overgrown garden"
6. "a colorful toy robot exploring a miniature fairy garden"
```

---

### 2. Тест пустого промпта

**Шаги:**
1. Создать Split Grid Node
2. Модал → выбрать 4 изображения
3. **НЕ вводить** базовый промпт (пустое поле)
4. Нажать "Создать"

**Ожидаемый результат:**
- ✅ Без генерации (нет вызова Anthropic)
- ✅ Создаются 4 ноды с пустыми промптами
- Пользователь заполняет вручную

---

### 3. Тест ошибки (без API key)

**Шаги:**
1. В `.env.local` удалить или закомментировать:
   ```env
   # ANTHROPIC_API_KEY=...
   ```
2. Создать Split Grid → ввести промпт → создать

**Ожидаемый результат:**
- ⚠️ Индикатор: "Не удалось сгенерировать варианты, использую базовый промпт для всех"
- ✅ Fallback: все 6 нод получают одинаковый базовый промпт
- Генерация картинок работает (это другой API)

---

### 4. Тест 1 промпта (оптимизация)

**Шаги:**
1. Split Grid → выбрать **4 изображения**
2. Ввести промпт: `"a sunset over mountains"`
3. Создать

**Внутренняя оптимизация:**
```typescript
if (n === 1) {
  return [basePrompt]; // Без вызова API
}
```

**Результат:**
- ✅ Если n=1, возвращает сразу
- ✅ Если n>1, вызывает Anthropic

---

## 📂 Измененные файлы

### Новые (1)
1. **`src/lib/llm/generatePromptVariants.ts`**
   - Helper функция для генерации вариантов
   - Anthropic API integration
   - Robust parsing (JSON + fallback)
   - Error handling

### Обновленные (1)
2. **`src/components/SplitGridSettingsModal.tsx`**
   - Импорт: `generatePromptVariants`
   - State: `isGenerating`, `generateError`
   - handleCreate: async, вызывает генерацию
   - UI: индикаторы loading/error
   - Кнопки: disabled state

---

## 🔑 Кредиты

### MVP подход:
- ✅ Генерация промптов НЕ списывает кредиты (пока)
- ✅ Только генерация картинок списывает (как раньше: 8 кредитов за Seedream)

### Будущее (опционально):
Можно добавить списание за LLM:
```typescript
if (defaultPrompt && targetCount > 1) {
  await adjustCredits(userId, -2, 'generation', 'LLM: Prompt variants');
}
```

---

## 🔒 Безопасность

### ✅ API ключ на сервере
- `ANTHROPIC_API_KEY` используется только в helper (server-side)
- Клиент НЕ имеет доступа к ключу
- Helper вызывается из модала (client component), но executes server-side

**Wait... проблема!** 🚨

Модал - это client component, а `generatePromptVariants` импортирует `Anthropic` SDK который требует server environment.

**Решение:** Нужно переместить генерацию на server!

---

## ⚠️ ВАЖНО: Server-side fix

### Проблема:
`SplitGridSettingsModal` - client component  
`generatePromptVariants` - импортирует Anthropic SDK (server-only)

### Решение:
Создать API route:

**`src/app/api/generate-prompt-variants/route.ts`:**
```typescript
import { generatePromptVariants } from "@/lib/llm/generatePromptVariants";

export async function POST(request: Request) {
  const { basePrompt, count } = await request.json();
  
  try {
    const variants = await generatePromptVariants(basePrompt, count);
    return NextResponse.json({ success: true, variants });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**В модале:**
```typescript
const response = await fetch("/api/generate-prompt-variants", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ basePrompt: defaultPrompt, count: targetCount }),
});

const data = await response.json();
if (data.success) {
  promptVariants = data.variants;
} else {
  // fallback
}
```

---

## 🔧 Доработка (необходима!)

**Создам API route сейчас:**

