/**
 * Diff Understanding/Analyzer Module
 *
 * This module transforms raw git diff data into human-readable summaries
 * and structured analysis. It:
 * - Categorizes changes by type (feature, refactor, config, etc.)
 * - Identifies key files that are most important to understand
 * - Infers intent from commit messages and change patterns
 * - Generates high-level summaries for presentation
 *
 * Design Decision: This module operates purely on data structures and
 * doesn't make git calls. It receives GitDiff and produces DiffSummary.
 * This makes it testable and reusable.
 */

import type {
  GitDiff,
  DiffSummary,
  CategorizedChange,
  ChangeCategory,
  ChangedFile
} from '../types';

// =============================================================================
// File Pattern Matchers
// =============================================================================

/**
 * Patterns used to categorize files by their path and extension.
 * These help automatically categorize changes based on file types.
 */
const FILE_PATTERNS: Record<ChangeCategory, RegExp[]> = {
  'configuration': [
    /\.config\.(js|ts|json|yaml|yml)$/,
    /package\.json$/,
    /tsconfig.*\.json$/,
    /\.env(\..+)?$/,
    /webpack|rollup|vite|esbuild/i,
    /docker|compose/i,
    /\.github\//,
    /Makefile$/,
    /\.yml$/,
    /\.yaml$/,
  ],
  'testing': [
    /\.(test|spec)\.(js|ts|jsx|tsx)$/,
    /__(tests|mocks)__\//,
    /\.test\./,
    /\.spec\./,
    /test\//,
    /tests\//,
    /jest\.config/,
    /vitest\.config/,
  ],
  'documentation': [
    /\.md$/,
    /\.mdx$/,
    /docs?\//,
    /README/i,
    /CHANGELOG/i,
    /LICENSE/i,
    /CONTRIBUTING/i,
  ],
  'new-feature': [], // Determined by change type, not pattern
  'modified-logic': [], // Determined by change type, not pattern
  'refactoring': [], // Determined by change pattern analysis
  'deletion': [], // Determined by change type
};

/**
 * Determines the category of a file based on its path.
 * Returns null if no pattern matches (file should be categorized by change type).
 */
function categorizeFileByPath(filePath: string): ChangeCategory | null {
  for (const [category, patterns] of Object.entries(FILE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(filePath)) {
        return category as ChangeCategory;
      }
    }
  }
  return null;
}

// =============================================================================
// Change Categorization
// =============================================================================

/**
 * Categorizes a single file change into a change category.
 *
 * Priority:
 * 1. Path-based patterns (config, test, docs)
 * 2. Change type (added -> new-feature, deleted -> deletion)
 * 3. Default to modified-logic
 */
function categorizeChange(file: ChangedFile): ChangeCategory {
  // First check path patterns
  const pathCategory = categorizeFileByPath(file.path);
  if (pathCategory) {
    return pathCategory;
  }

  // Then check change type
  switch (file.changeType) {
    case 'added':
      return 'new-feature';
    case 'deleted':
      return 'deletion';
    case 'renamed':
      return 'refactoring';
    case 'modified':
    default:
      return 'modified-logic';
  }
}

/**
 * Groups files by their change category and creates human-readable descriptions.
 */
export function categorizeChanges(files: ChangedFile[]): CategorizedChange[] {
  // Group files by category
  const grouped = new Map<ChangeCategory, ChangedFile[]>();

  for (const file of files) {
    const category = categorizeChange(file);
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(file);
  }

  // Convert to CategorizedChange array with descriptions
  const changes: CategorizedChange[] = [];

  for (const [category, categoryFiles] of grouped) {
    const description = generateCategoryDescription(category, categoryFiles);
    changes.push({
      category,
      description,
      files: categoryFiles.map(f => f.path),
    });
  }

  // Sort by importance (features first, then logic, then others)
  const categoryOrder: ChangeCategory[] = [
    'new-feature',
    'modified-logic',
    'refactoring',
    'deletion',
    'configuration',
    'testing',
    'documentation',
  ];

  changes.sort((a, b) =>
    categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
  );

  return changes;
}

/**
 * Generates a human-readable description for a category of changes.
 */
function generateCategoryDescription(
  category: ChangeCategory,
  files: ChangedFile[]
): string {
  const fileCount = files.length;
  const totalAdded = files.reduce((sum, f) => sum + f.linesAdded, 0);
  const totalRemoved = files.reduce((sum, f) => sum + f.linesRemoved, 0);

  switch (category) {
    case 'new-feature':
      return `Added ${fileCount} new file${fileCount > 1 ? 's' : ''} (+${totalAdded} lines)`;

    case 'modified-logic':
      return `Modified logic in ${fileCount} file${fileCount > 1 ? 's' : ''} (+${totalAdded}/-${totalRemoved} lines)`;

    case 'refactoring':
      return `Refactored/renamed ${fileCount} file${fileCount > 1 ? 's' : ''}`;

    case 'deletion':
      return `Removed ${fileCount} file${fileCount > 1 ? 's' : ''} (-${totalRemoved} lines)`;

    case 'configuration':
      return `Updated configuration in ${fileCount} file${fileCount > 1 ? 's' : ''}`;

    case 'testing':
      return `${fileCount > 1 ? 'Tests' : 'Test'} ${files.some(f => f.changeType === 'added') ? 'added' : 'modified'} (+${totalAdded}/-${totalRemoved} lines)`;

    case 'documentation':
      return `Documentation ${files.some(f => f.changeType === 'added') ? 'added' : 'updated'}`;

    default:
      return `Changed ${fileCount} file${fileCount > 1 ? 's' : ''}`;
  }
}

// =============================================================================
// Key File Identification
// =============================================================================

/**
 * Identifies the most important files to understand in the diff.
 *
 * Importance factors:
 * - Lines changed (more changes = more important)
 * - File type (source code > config > docs)
 * - Change type (new features > modifications)
 */
export function identifyKeyFiles(files: ChangedFile[], limit: number = 5): string[] {
  // Score each file
  const scored = files.map(file => {
    let score = 0;

    // Lines changed (primary factor)
    score += (file.linesAdded + file.linesRemoved);

    // Boost for source code files
    if (/\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c)$/.test(file.path)) {
      score *= 1.5;
    }

    // Boost for new files
    if (file.changeType === 'added') {
      score *= 1.3;
    }

    // Reduce score for test files (important but not primary)
    if (/\.(test|spec)\./.test(file.path)) {
      score *= 0.7;
    }

    // Reduce score for config/docs
    if (categorizeFileByPath(file.path) === 'configuration') {
      score *= 0.5;
    }
    if (categorizeFileByPath(file.path) === 'documentation') {
      score *= 0.3;
    }

    return { file, score };
  });

  // Sort by score and take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.file.path);
}

// =============================================================================
// Intent Inference
// =============================================================================

/**
 * Common patterns in branch names and commit messages that indicate intent.
 */
const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: string }> = [
  { pattern: /feat(ure)?[\/\-_]/i, intent: 'add new functionality' },
  { pattern: /fix[\/\-_]/i, intent: 'fix a bug or issue' },
  { pattern: /bug[\/\-_]/i, intent: 'address a bug' },
  { pattern: /refactor[\/\-_]/i, intent: 'improve code structure' },
  { pattern: /perf(ormance)?[\/\-_]/i, intent: 'improve performance' },
  { pattern: /docs?[\/\-_]/i, intent: 'update documentation' },
  { pattern: /test[\/\-_]/i, intent: 'add or improve tests' },
  { pattern: /chore[\/\-_]/i, intent: 'perform maintenance tasks' },
  { pattern: /hotfix[\/\-_]/i, intent: 'apply an urgent fix' },
  { pattern: /release[\/\-_]/i, intent: 'prepare a release' },
  { pattern: /deps?[\/\-_]/i, intent: 'update dependencies' },
  { pattern: /upgrade[\/\-_]/i, intent: 'upgrade dependencies or tools' },
  { pattern: /migration?[\/\-_]/i, intent: 'perform a data or code migration' },
];

/**
 * Infers the intent of the branch from branch name and commit messages.
 *
 * This is a heuristic - it may not always be accurate, but it provides
 * a starting point for understanding the purpose of changes.
 */
export function inferIntent(diff: GitDiff): string {
  const branchName = diff.context.currentBranch;
  const commits = diff.commits;

  // First, check branch name patterns
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(branchName)) {
      // Extract the meaningful part after the prefix
      const parts = branchName.split(/[\/\-_]/);
      const description = parts.slice(1).join(' ').replace(/[-_]/g, ' ');
      if (description.length > 0) {
        return `${intent}: ${description}`;
      }
      return intent;
    }
  }

  // If no pattern matched, try to infer from commits
  if (commits.length > 0) {
    // Look at the first commit message (usually describes the goal)
    const firstCommit = commits[commits.length - 1]; // Oldest first
    return `Based on commits: ${firstCommit.message}`;
  }

  // Fallback: describe based on change types
  const changes = categorizeChanges(diff.files);
  const categories = changes.map(c => c.category);

  if (categories.includes('new-feature')) {
    return 'Add new functionality to the codebase';
  } else if (categories.includes('deletion')) {
    return 'Remove unused code or features';
  } else if (categories.includes('refactoring')) {
    return 'Improve code structure without changing behavior';
  } else if (categories.includes('configuration')) {
    return 'Update project configuration';
  }

  return 'Make changes to the codebase';
}

// =============================================================================
// Overview Generation
// =============================================================================

/**
 * Generates a one-sentence overview of what the branch does.
 *
 * This is displayed at the top of the summary before questions.
 */
export function generateOverview(diff: GitDiff): string {
  const stats = diff.stats;
  const fileCount = diff.files.length;
  const intent = inferIntent(diff);

  // Start with a size descriptor
  let sizeDescriptor: string;
  const totalLines = stats.linesAdded + stats.linesRemoved;

  if (totalLines < 50) {
    sizeDescriptor = 'small';
  } else if (totalLines < 200) {
    sizeDescriptor = 'moderate';
  } else if (totalLines < 500) {
    sizeDescriptor = 'substantial';
  } else {
    sizeDescriptor = 'large';
  }

  return `A ${sizeDescriptor} change across ${fileCount} file${fileCount !== 1 ? 's' : ''} to ${intent.toLowerCase()}.`;
}

// =============================================================================
// Main Summary Generation
// =============================================================================

/**
 * Generates a complete diff summary from git diff data.
 *
 * This is the main entry point for the analyzer module.
 * It combines all analysis functions to produce a comprehensive summary.
 */
export function generateDiffSummary(diff: GitDiff): DiffSummary {
  return {
    overview: generateOverview(diff),
    changes: categorizeChanges(diff.files),
    inferredIntent: inferIntent(diff),
    keyFiles: identifyKeyFiles(diff.files),
    stats: diff.stats,
    filesChanged: diff.files.map(f => f.path),
  };
}
