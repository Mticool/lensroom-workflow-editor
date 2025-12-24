# SQL Generator Utility

Утилита для генерации готовых SQL команд для Supabase.

---

## Зачем?

Вместо того чтобы писать SQL вручную с плейсхолдерами типа `<YOUR_USER_ID>`, эта утилита генерирует **полностью готовые SQL команды** с реальными значениями, которые можно **скопировать и вставить** в Supabase SQL Editor.

---

## Использование

### Режим 1: По Telegram ID

Когда вы знаете Telegram ID пользователя:

```bash
npm run sql:topup:tg -- --telegram 250474388 --amount 100
```

**Что генерируется:**
- SQL для поиска `auth_user_id` по `telegram_id`
- SQL для начисления кредитов
- Блок DO $$ для автоматического выполнения обоих шагов

**Пример вывода:**

```sql
-- Step 1: Find auth_user_id
SELECT auth_user_id, username
FROM public.telegram_profiles 
WHERE telegram_id = 250474388;

-- Step 2: Top-up credits
SELECT * FROM public.adjust_credits(
  p_user_id := '<AUTH_USER_ID>'::uuid,
  p_amount := 100,
  p_type := 'bonus',
  p_description := 'Manual top-up for telegram_id=250474388'
);

-- Or run both in one go:
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT auth_user_id INTO v_user_id
  FROM public.telegram_profiles
  WHERE telegram_id = 250474388;
  
  PERFORM public.adjust_credits(v_user_id, 100, 'bonus', '...');
END $$;
```

---

### Режим 2: По User ID

Когда вы уже знаете UUID пользователя:

```bash
npm run sql:topup:user -- --user 1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3 --amount 100
```

**Что генерируется:**
- SQL для начисления кредитов
- SQL для проверки нового баланса
- SQL для просмотра последних транзакций

**Пример вывода:**

```sql
-- Top-up 100 credits
SELECT * FROM public.adjust_credits(
  p_user_id := '1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3'::uuid,
  p_amount := 100,
  p_type := 'bonus',
  p_description := 'Manual top-up via script'
);

-- Verify new balance
SELECT * FROM public.get_user_balance('1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3'::uuid);

-- View recent transactions
SELECT * FROM public.credit_transactions
WHERE user_id = '1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3'::uuid
ORDER BY created_at DESC LIMIT 5;
```

---

### Режим 3: Кастомные параметры

```bash
npm run sql:topup -- --user <uuid> --amount 500
npm run sql:topup -- --telegram 123456 --amount -50
```

**Параметры:**
- `--telegram <id>` или `-t <id>` - Telegram ID
- `--user <uuid>` или `-u <uuid>` - User UUID
- `--amount <number>` или `-a <number>` - Количество кредитов (может быть отрицательным)

---

## Примеры использования

### Начислить 100 кредитов пользователю

```bash
npm run sql:topup:user -- --user 1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3 --amount 100
```

### Списать 50 кредитов

```bash
npm run sql:topup -- --user 1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3 --amount -50
```

### Найти пользователя по Telegram и начислить

```bash
npm run sql:topup -- --telegram 250474388 --amount 1000
```

---

## Как использовать сгенерированный SQL

1. **Запустите команду** в терминале
2. **Скопируйте** весь блок SQL из вывода (между рамками)
3. **Откройте** Supabase Dashboard → SQL Editor
4. **Вставьте** SQL и нажмите **Run** (или Cmd/Ctrl + Enter)
5. **Проверьте** результат

---

## Преимущества

✅ **Нет плейсхолдеров** - все значения уже подставлены
✅ **Безопасно** - скрипт не выполняет SQL, только генерирует
✅ **Красиво** - цветной вывод с рамками
✅ **Быстро** - копировать и вставить
✅ **Проверка** - включены команды для верификации результата

---

## Кастомизация

Отредактируйте `scripts/genSqlTopup.ts` чтобы:
- Изменить типы транзакций (bonus, purchase, refund)
- Добавить дополнительные метаданные
- Изменить формат вывода
- Добавить новые режимы (например, bulk top-up)

---

## Технические детали

**Что НЕ делает скрипт:**
- ❌ Не подключается к Supabase
- ❌ Не выполняет SQL
- ❌ Не требует API ключей

**Что делает скрипт:**
- ✅ Парсит аргументы командной строки
- ✅ Валидирует входные данные
- ✅ Генерирует SQL текст
- ✅ Выводит в терминал

**Зависимости:**
- `tsx` - для запуска TypeScript
- Никаких внешних библиотек

---

## Примеры сценариев

### Сценарий 1: Новый пользователь получил бонус

```bash
# Пользователь зарегистрировался через Telegram
npm run sql:topup -- --telegram 250474388 --amount 50

# Копируем SQL и выполняем в Supabase
```

### Сценарий 2: Возврат средств

```bash
# Генерация не удалась, возвращаем кредиты
npm run sql:topup -- --user 1a13c194-06ce-4d18-8b36-b9eaf0a5d5d3 --amount 10
```

### Сценарий 3: Тестирование

```bash
# Добавляем тестовые кредиты для проверки
npm run sql:topup -- --user 00000000-0000-0000-0000-000000000000 --amount 9999
```

---

## FAQ

**Q: Можно ли начислить отрицательное количество кредитов?**
A: Да, используйте `--amount -50` для списания.

**Q: Что если пользователь не найден?**
A: При использовании Telegram режима, вы сначала получите результат поиска. Если пользователь не найден, блок DO $$ выдаст ошибку.

**Q: Можно ли использовать в production?**
A: Да, но лучше создать веб-интерфейс для администраторов. Эта утилита удобна для быстрых ручных операций.

**Q: Безопасно ли?**
A: Да, скрипт только генерирует текст. Вы сами решаете выполнять SQL или нет.

---

## Расширения

### Идеи для улучшения:

1. **Bulk operations** - Начислить кредиты нескольким пользователям
2. **CSV import** - Импорт списка из файла
3. **Templates** - Сохраненные шаблоны для разных типов операций
4. **History** - Логирование выполненных операций
5. **Dry-run mode** - Показать что произойдет без выполнения

---

## См. также

- `docs/SUPABASE_SETUP.md` - Настройка Supabase
- `scripts/quickTest.ts` - Тестирование операций с кредитами
- `scripts/smokeSupabase.ts` - Полная проверка системы

