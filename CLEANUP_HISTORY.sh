#!/bin/bash
# Script to clean git history from leaked secrets
# WARNING: This will rewrite git history. Make a backup first!

set -e  # Exit on error

echo "================================"
echo "Git History Cleanup - Leaked Secrets"
echo "================================"
echo ""

# Navigate to project root
cd /Users/maratsagimov/ai-workflow-builder

echo "Step 1: Checking git-filter-repo..."
if ! command -v git-filter-repo &> /dev/null; then
    echo "❌ git-filter-repo not found!"
    echo ""
    echo "Installing via Homebrew..."
    brew install git-filter-repo
    echo "✅ Installed"
else
    echo "✅ git-filter-repo found"
fi

echo ""
echo "Step 2: Creating backup..."
# Create backup branch
git branch backup-before-cleanup-$(date +%Y%m%d-%H%M%S) || true
echo "✅ Backup created"

echo ""
echo "Step 3: Verifying replacements.txt..."
if [ ! -f "replacements.txt" ]; then
    echo "❌ replacements.txt not found!"
    exit 1
fi
echo "✅ replacements.txt exists"

echo ""
echo "Step 4: Running git-filter-repo..."
echo "⚠️  This will rewrite ALL commits in history!"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Run filter-repo with replacements
git filter-repo --replace-text replacements.txt --force

echo ""
echo "✅ History cleaned!"

echo ""
echo "Step 5: Re-adding remote..."
# filter-repo removes remotes, need to re-add
git remote add origin https://github.com/Mticool/lensroom-workflow-editor.git

echo ""
echo "Step 6: Verifying secrets are gone..."
echo "Checking for leaked keys..."
if grep -r "sk-ant-api03-FCUs" . 2>/dev/null; then
    echo "⚠️  WARNING: Anthropic key still found!"
else
    echo "✅ No Anthropic key found"
fi

if grep -r "e57410c3e5ffbaa7" . 2>/dev/null; then
    echo "⚠️  WARNING: KIE key still found!"
else
    echo "✅ No KIE key found"
fi

echo ""
echo "================================"
echo "✅ CLEANUP COMPLETE"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Review changes: git log --oneline"
echo "2. Force push: git push origin master --force"
echo "3. Revoke old API keys:"
echo "   - Anthropic: https://console.anthropic.com/settings/keys"
echo "   - KIE.AI: https://kie.ai (settings)"
echo "   - Supabase: https://supabase.com/dashboard"
echo ""

