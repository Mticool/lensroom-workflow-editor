# 🔒 Security Cleanup - Git History

## ⚠️ Проблема
API ключи (Anthropic, KIE, Supabase) попали в коммиты и историю Git. GitHub блокирует push из-за обнаружения секретов.

## ✅ Решение
Очистка истории через `git-filter-repo` с полной заменой секретов на плейсхолдеры.

---

## 📋 Пошаговая инструкция

### 1. Проверить текущее состояние

```bash
cd /Users/maratsagimov/ai-workflow-builder

# Проверить remote
git remote -v
# Должно быть: origin https://github.com/Mticool/lensroom-workflow-editor.git

# Проверить что секреты удалены из рабочей копии
grep -r "sk-ant-api03-FCUs" . 2>/dev/null || echo "✅ No Anthropic key"
grep -r "e57410c3e5ffbaa7" . 2>/dev/null || echo "✅ No KIE key"

# Проверить статус
git status
```

---

### 2. Установить git-filter-repo (если нет)

```bash
# Проверить наличие
git filter-repo --version

# Если нет - установить через Homebrew
brew install git-filter-repo
```

---

### 3. АВТОМАТИЧЕСКИЙ способ (рекомендуется)

```bash
# Запустить подготовленный скрипт
./CLEANUP_HISTORY.sh
```

Скрипт выполнит:
- Проверку git-filter-repo
- Создание backup ветки
- Очистку истории через replacements.txt
- Проверку что секреты удалены
- Re-add remote (filter-repo удаляет remotes)

---

### 4. РУЧНОЙ способ (если нужен контроль)

```bash
# 4.1 Создать backup
git branch backup-before-cleanup-$(date +%Y%m%d-%H%M%S)

# 4.2 Запустить filter-repo
git filter-repo --replace-text replacements.txt --force

# 4.3 Re-add remote (filter-repo удаляет его)
git remote add origin https://github.com/Mticool/lensroom-workflow-editor.git

# 4.4 Проверить что секреты удалены
git log --all --oneline | head -20
grep -r "sk-ant-" . 2>/dev/null || echo "✅ Clean"
```

---

### 5. Force Push в GitHub

```bash
# Проверить что готовы
git log --oneline | head -10

# Force push (перезапишет историю на GitHub)
git push origin master --force

# Если несколько веток
git push origin --all --force
git push origin --tags --force
```

---

### 6. Revoke старые API ключи

После успешного push **обязательно** смените ключи:

#### Anthropic
1. https://console.anthropic.com/settings/keys
2. Revoke: `sk-ant-api03-FCUs...`
3. Create new key
4. Обновить в `.env.local` и Vercel

#### KIE.AI
1. https://kie.ai (Settings → API Keys)
2. Revoke: `e57410c3e5ffbaa7...`
3. Generate new
4. Обновить в `.env.local` и Vercel

#### Supabase
1. https://supabase.com/dashboard/project/hujjvnubkoyxmmfrnllv/settings/api
2. **Reset** Service Role Key
3. Copy new key
4. Обновить в `.env.local` и Vercel

---

## 🔍 Проверка после cleanup

```bash
# 1. Проверить что секретов нет в истории
git log --all --full-history --source --oneline -S "sk-ant-api03-FCUs" || echo "✅ Clean"

# 2. Проверить текущие файлы
grep -r "sk-ant-" . --include="*.md" --include="*.ts" 2>/dev/null || echo "✅ Clean"

# 3. Проверить что remote правильный
git remote -v

# 4. Проверить статус
git status
```

---

## 📁 Файлы в репозитории

- `replacements.txt` - правила замены для git-filter-repo
- `CLEANUP_HISTORY.sh` - автоматический скрипт очистки
- `SECURITY_CLEANUP_README.md` - эта инструкция

---

## ⚠️ ВАЖНО

1. **Backup создан** - есть ветка `backup-before-cleanup-*`
2. **Force push перезапишет историю** на GitHub - коллеги должны сделать `git pull --rebase` или `git clone` заново
3. **Старые ключи необходимо revoke** сразу после push
4. **`.env.local` никогда не коммитить** - он в .gitignore

---

## 🆘 Если что-то пошло не так

### Откатить изменения локально
```bash
# Вернуться к backup ветке
git checkout backup-before-cleanup-YYYYMMDD-HHMMSS

# Создать новую ветку
git checkout -b master-restored

# Force push (если нужно)
git push origin master-restored --force
```

### Восстановить remote
```bash
# Если filter-repo удалил remote
git remote add origin https://github.com/Mticool/lensroom-workflow-editor.git
```

---

## ✅ Финальный чеклист

- [ ] git-filter-repo установлен
- [ ] Backup ветка создана
- [ ] Секреты удалены из рабочей копии (проверено grep)
- [ ] История очищена (git filter-repo)
- [ ] Remote re-added
- [ ] Force push выполнен
- [ ] Старые ключи revoked:
  - [ ] Anthropic
  - [ ] KIE.AI
  - [ ] Supabase
- [ ] Новые ключи добавлены в:
  - [ ] `.env.local`
  - [ ] Vercel Environment Variables
- [ ] Vercel redeploy (если нужно)

