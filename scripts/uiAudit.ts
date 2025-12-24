#!/usr/bin/env tsx
/**
 * UI Audit - Check for English strings in UI components
 * 
 * Scans UI files for English strings that should be in Russian.
 * Only checks string literals in quotes, ignores:
 * - console.log/error/warn
 * - Function/variable names
 * - Server-side code (src/app/api, src/lib)
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Patterns to search for (only in quoted strings)
const uiPatterns = [
  { pattern: /["'`]Failed["'`]/, description: 'Error message (should be "Ошибка")' },
  { pattern: /["'`]Failed to[^"'`]*["'`]/, description: 'Error message starting with "Failed to"' },
  { pattern: /["'`]Run to generate["'`]/, description: 'Placeholder text' },
  { pattern: /["'`]Regenerate["'`]/, description: 'Button text' },
  { pattern: /["'`]Clear output["'`]/, description: 'Button text' },
  { pattern: /["'`]Unknown error["'`]/, description: 'Generic error message' },
  { pattern: /["'`]LLM Generate["'`]/, description: 'Node title' },
];

// Directories to scan
const scanDirs = [
  'src/components',
  'src/app',
  'src/store',
];

// Directories/files to ignore
const ignoreDirs = [
  'src/app/api',      // Server-side API routes
  'src/lib',          // Server-side utilities
  'node_modules',
  '.next',
  'dist',
];

interface Match {
  file: string;
  line: number;
  content: string;
  pattern: string;
}

function shouldIgnoreFile(filePath: string): boolean {
  // Ignore if path contains any ignore directory
  return ignoreDirs.some(dir => filePath.includes(dir));
}

function isConsoleStatement(line: string): boolean {
  // Check if line contains console.log/error/warn/debug
  return /console\.(log|error|warn|debug|info)/.test(line);
}

function scanFile(filePath: string): Match[] {
  const matches: Match[] = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Skip console statements
      if (isConsoleStatement(line)) {
        return;
      }
      
      // Check each pattern
      uiPatterns.forEach(({ pattern, description }) => {
        if (pattern.test(line)) {
          matches.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            pattern: description,
          });
        }
      });
    });
  } catch (error) {
    // Skip files that can't be read
  }
  
  return matches;
}

function scanDirectory(dir: string, baseDir: string): Match[] {
  let allMatches: Match[] = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      
      // Skip ignored paths
      if (shouldIgnoreFile(fullPath)) {
        continue;
      }
      
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recurse into subdirectories
        allMatches = allMatches.concat(scanDirectory(fullPath, baseDir));
      } else if (stat.isFile()) {
        // Only scan .ts and .tsx files
        if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
          const matches = scanFile(fullPath);
          allMatches = allMatches.concat(matches);
        }
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
  
  return allMatches;
}

// Main
const baseDir = process.cwd();

log('\n' + '='.repeat(70), colors.cyan);
log('  UI Audit - Checking for English strings', colors.cyan);
log('='.repeat(70) + '\n', colors.cyan);

log('Scanning directories:', colors.blue);
scanDirs.forEach(dir => log(`  - ${dir}`, colors.blue));
log('');

let allMatches: Match[] = [];

for (const dir of scanDirs) {
  const fullPath = join(baseDir, dir);
  try {
    const matches = scanDirectory(fullPath, baseDir);
    allMatches = allMatches.concat(matches);
  } catch (error) {
    log(`⚠️  Could not scan ${dir}: ${error}`, colors.yellow);
  }
}

log('='.repeat(70), colors.cyan);

if (allMatches.length === 0) {
  log('✅ UI AUDIT PASSED', colors.green);
  log('No English UI strings found', colors.green);
  log('='.repeat(70) + '\n', colors.cyan);
  process.exit(0);
} else {
  log(`❌ UI AUDIT FAILED - Found ${allMatches.length} issues`, colors.red);
  log('='.repeat(70) + '\n', colors.cyan);
  
  // Group by file
  const byFile = new Map<string, Match[]>();
  allMatches.forEach(match => {
    const relativePath = relative(baseDir, match.file);
    if (!byFile.has(relativePath)) {
      byFile.set(relativePath, []);
    }
    byFile.get(relativePath)!.push(match);
  });
  
  // Print results
  byFile.forEach((matches, file) => {
    log(`\n📄 ${file}:`, colors.yellow);
    matches.forEach(match => {
      log(`  Line ${match.line}: ${match.pattern}`, colors.blue);
      log(`    ${match.content.substring(0, 100)}${match.content.length > 100 ? '...' : ''}`, colors.reset);
    });
  });
  
  log('\n' + '='.repeat(70), colors.cyan);
  log('Please translate these strings to Russian', colors.yellow);
  log('='.repeat(70) + '\n', colors.cyan);
  
  process.exit(1);
}
