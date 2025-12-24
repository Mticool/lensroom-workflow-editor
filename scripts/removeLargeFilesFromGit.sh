#!/bin/bash
# Remove large contact-sheet JSON files from git history
# WARNING: This rewrites git history. Use with caution.

set -e

echo "⚠️  WARNING: This will rewrite git history!"
echo "Files to remove from git history:"
git rev-list --objects --all | grep -E "contact-sheet.*\.json$" | awk '{print $2}'
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo "Removing files from git history..."

# Remove files from all commits
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch examples/contact-sheet-*.json examples/contact-sheet-ChrisWalkman.json examples/contact-sheet-billsSupra.json examples/contact-sheet-tim.json examples/contact-sheet-jpow.json examples/contact-sheet-bills-supra.json' \
  --prune-empty --tag-name-filter cat -- --all

echo "Cleaning up..."
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "✅ Done! Files removed from git history."
echo "⚠️  IMPORTANT: You need to force push: git push origin --force --all"

