#!/bin/bash
# Quick commands reference for security cleanup

echo "================================"
echo "Security Cleanup - Quick Commands"
echo "================================"
echo ""

# Navigate to project
cd /Users/maratsagimov/ai-workflow-builder

echo "1️⃣ Verify current state:"
echo "------------------------"
echo ""
echo "# Check remote:"
git remote -v
echo ""
echo "# Check for secrets (should return 'No matches found'):"
grep -r "sk-ant-api03-FCUs" . 2>/dev/null || echo "✅ No Anthropic key"
grep -r "e57410c3e5ffbaa7" . 2>/dev/null || echo "✅ No KIE key"
echo ""
echo "# Git status:"
git status
echo ""

echo "2️⃣ Install git-filter-repo (if needed):"
echo "----------------------------------------"
echo "brew install git-filter-repo"
echo ""

echo "3️⃣ Run cleanup (CHOOSE ONE):"
echo "-----------------------------"
echo ""
echo "OPTION A - Automatic (recommended):"
echo "  ./CLEANUP_HISTORY.sh"
echo ""
echo "OPTION B - Manual:"
echo "  git branch backup-\$(date +%Y%m%d-%H%M%S)"
echo "  git filter-repo --replace-text replacements.txt --force"
echo "  git remote add origin https://github.com/Mticool/lensroom-workflow-editor.git"
echo ""

echo "4️⃣ Force push:"
echo "---------------"
echo "  git push origin master --force"
echo ""

echo "5️⃣ Revoke old keys:"
echo "--------------------"
echo "  Anthropic: https://console.anthropic.com/settings/keys"
echo "  KIE.AI: https://kie.ai"
echo "  Supabase: https://supabase.com/dashboard"
echo ""

