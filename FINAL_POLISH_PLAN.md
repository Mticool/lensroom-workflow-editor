# 🎯 Финальная доводка перед Vercel - План

Проведен анализ. Вот что нужно сделать:

---

## ✅ Что уже готово:

1. **FloatingActionBar** - полностью на русском ✅
2. **SplitGridSettingsModal** - полностью на русском ✅
3. **ConnectionDropMenu** - полностью на русском ✅
4. **Anthropic API** - работает ✅
5. **Kie.ai API** (Seedream, NanoBanana, Veo) - работает ✅
6. **Credits system** - работает ✅
7. **SF Pro font** - подключен ✅

---

## 🔧 Требуется доработка:

### Приоритет 1: LLMGenerateNode (КРИТИЧНО)

**Файл:** `src/components/nodes/LLMGenerateNode.tsx`

**Проблемы:**
- `title="LLM Generate"` → Нужно: "Генератор текста (LLM)"
- `"Failed"` → Нужно: "Ошибка"
- Нет режима "улучшить промпт"

**Решение:**
```typescript
// Line 126: Change title
<BaseNode
  id={id}
  title="Генератор текста (LLM)"
  ...
>

// Line 173: Change "Failed"
<span className="text-[10px] text-red-400">
  {nodeData.error || "Ошибка"}
</span>

// Add "Improve prompt" mode:
// 1. Add state: const [improveMode, setImproveMode] = useState(false);
// 2. Add button/toggle above output area
// 3. On click: call /api/infer with anthropic_text and instruction:
//    "Сохрани смысл. Улучши структуру и конкретику. Не меняй стиль радикально. Верни один финальный промпт."
// 4. Replace input prompt with improved version
// 5. Add "Undo" button
```

---

### Приоритет 2: NanoBananaNode (ВАЖНО)

**Файл:** `src/components/nodes/NanoBananaNode.tsx`

**Проблемы:**
- Нет "PRO" бейджа рядом с селектом
- Нет описаний моделей

**Решение:**
```typescript
// After model selector (line 208), add:
{isNanoBananaPro && (
  <span className="ml-2 px-1.5 py-0.5 text-[8px] font-semibold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded">
    PRO
  </span>
)}

// After model selector, add description:
<div className="text-[9px] text-neutral-500 mt-1">
  {nodeData.model === "nano-banana" 
    ? "Редактирование изображения" 
    : "Редактирование изображения (Pro)"}
</div>
```

---

### Приоритет 3: Veo Node (СРЕДНИЙ)

**Проверить:**
1. Поддерживает ли Kie Veo API входное изображение (first frame)?
2. Если ДА → добавить image input handle + передавать в API
3. Если НЕТ → добавить заметку в UI: "Текст → видео (image-to-video в разработке)"

**Файлы для проверки:**
- `src/lib/kie/client.ts` - `inferVeo()` function
- Документация Kie.ai Veo API

---

### Приоритет 4: UI Audit Script

**Создать:** `scripts/uiAudit.ts`

```typescript
#!/usr/bin/env tsx
// Quick audit for English strings in UI

import { execSync } from 'child_process';

const patterns = [
  'LLM Generate',
  'Run to generate',
  'Regenerate',
  'Clear output',
  'Failed',
  'Run options',
  'Number of Images',
  'Default Prompt',
];

let foundIssues = false;

patterns.forEach(pattern => {
  try {
    const result = execSync(
      `grep -r "${pattern}" src/components --include="*.tsx" --include="*.ts"`,
      { encoding: 'utf-8' }
    );
    if (result) {
      console.log(`❌ Found "${pattern}":`);
      console.log(result);
      foundIssues = true;
    }
  } catch {
    // No matches (good!)
  }
});

if (!foundIssues) {
  console.log('✅ UI AUDIT PASSED - No English strings found');
  process.exit(0);
} else {
  console.log('\n❌ UI AUDIT FAILED - English strings found');
  process.exit(1);
}
```

**package.json:**
```json
{
  "scripts": {
    "ui:audit": "tsx scripts/uiAudit.ts"
  }
}
```

---

## 📝 Быстрый чеклист изменений:

### Обязательные (делать в первую очередь):
- [ ] LLMGenerateNode: title → "Генератор текста (LLM)"
- [ ] LLMGenerateNode: "Failed" → "Ошибка"
- [ ] NanoBananaNode: добавить PRO бейдж
- [ ] NanoBananaNode: добавить описания моделей
- [ ] Создать ui:audit script

### Желательные (если есть время):
- [ ] LLMGenerateNode: режим "улучшить промпт"
- [ ] Veo: проверить image-to-video support
- [ ] Типографика: проверить SF Pro применяется везде

---

## 🚀 Quick Fix (минимум для деплоя):

Если времени мало, сделать только это:

```bash
# 1. Fix LLM title
# src/components/nodes/LLMGenerateNode.tsx:126
title="Генератор текста (LLM)"

# 2. Fix "Failed"
# src/components/nodes/LLMGenerateNode.tsx:173
{nodeData.error || "Ошибка"}

# 3. Add PRO badge
# src/components/nodes/NanoBananaNode.tsx (after line 208)
{isNanoBananaPro && <span className="ml-2 px-1.5 py-0.5 text-[8px] font-semibold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded">PRO</span>}

# 4. Add model descriptions
# src/components/nodes/NanoBananaNode.tsx (after model selector)
<div className="text-[9px] text-neutral-500 mt-1">
  {nodeData.model === "nano-banana" ? "Редактирование изображения" : "Редактирование изображения (Pro)"}
</div>
```

---

## 📊 Статус перед деплоем:

| Компонент | Статус | Приоритет |
|-----------|--------|-----------|
| FloatingActionBar | ✅ Готов | - |
| SplitGridSettings | ✅ Готов | - |
| ConnectionMenu | ✅ Готов | - |
| LLMGenerateNode | ⚠️ Нужен перевод | 🔴 Критично |
| NanoBananaNode | ⚠️ Нужен PRO badge | 🟡 Важно |
| VeoNode | ✅ Работает | 🟢 OK |
| Credits | ✅ Работает | - |
| Anthropic API | ✅ Работает | - |

---

## 🎯 Команды для проверки:

```bash
# 1. Запустить dev
npm run dev

# 2. Проверить UI audit (после создания скрипта)
npm run ui:audit

# 3. Smoke test
npm run smoke

# 4. Verify integration
npm run verify:integration
```

---

## ✅ Manual checklist:

После изменений проверить:

1. **LLM Node:**
   - Title должен быть "Генератор текста (LLM)"
   - "Ошибка" вместо "Failed"
   - Модель "Anthropic (Text)" в dropdown

2. **Nano Banana Node:**
   - "PRO" бейдж при выборе Nano Banana Pro
   - Описание "Редактирование изображения" / "Редактирование изображения (Pro)"

3. **Split Grid Modal:**
   - Уже на русском ✅

4. **Run Menu:**
   - Уже на русском ✅

5. **Connection Menu:**
   - Уже на русском ✅

---

**Все готово для финальных правок!** 🚀

