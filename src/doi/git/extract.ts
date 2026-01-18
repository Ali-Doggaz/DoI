/**
 * Git Diff Extraction Module
 *
 * This module handles all interactions with git to extract diff information.
 * It provides functions to:
 * - Detect current branch and default branch (from remote)
 * - Compute merge base between branches
 * - Extract full diff with context
 * - Parse file changes and statistics
 *
 * Design Decision: This module returns raw data structures that are then
 * processed by the analyzer module. This separation allows the analyzer
 * to work with any diff source, not just git.
 */

import type {
  GitContext,
  GitDiff,
  ChangedFile,
  DiffStats,
  BranchCommit
} from '../types';

// =============================================================================
// Git Command Templates
// =============================================================================

/**
 * Git commands used by the extraction module.
 * These are exported so the skill definition can reference them.
 */
export const GIT_COMMANDS = {
  /** Get current branch name */
  currentBranch: 'git rev-parse --abbrev-ref HEAD',

  /**
   * Get the base branch (the branch the current branch was built on top of).
   *
   * Detection priority:
   * 1. Remote's default branch (origin/HEAD) - works for most cloned repos
   * 2. Upstream tracking branch - if current branch was created with -u or push -u
   * 3. Closest ancestor branch - finds the branch with the nearest merge-base
   *
   * This approach correctly handles branches created from any base (main, staging, develop, etc.)
   */
  defaultBranch: (currentBranch: string) =>
    // Try 1: Remote's configured default branch
    `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || ` +
    // Try 2: Upstream tracking branch for current branch
    `git config --get branch.${currentBranch}.merge 2>/dev/null | sed 's@^refs/heads/@@' || ` +
    // Try 3: Find closest ancestor branch by comparing merge-base distances (excluding current branch)
    `(for b in $(git branch -r | grep -v HEAD | grep -v "origin/${currentBranch}" | sed 's/^ *//'); do ` +
    `git merge-base HEAD "$b" >/dev/null 2>&1 && ` +
    `echo "$(git rev-list --count $(git merge-base HEAD "$b")..HEAD) \${b#origin/}"; ` +
    `done | sort -n | head -1 | awk '{print $2}')`,

  /** Get merge base between two refs */
  mergeBase: (defaultBranch: string) => `git merge-base ${defaultBranch} HEAD`,

  /** Get full diff from merge base to HEAD */
  diff: (mergeBase: string) => `git diff ${mergeBase}..HEAD`,

  /** Get diff with file stats */
  diffStat: (mergeBase: string) => `git diff --stat ${mergeBase}..HEAD`,

  /** Get diff with numstat (machine-readable) */
  diffNumstat: (mergeBase: string) => `git diff --numstat ${mergeBase}..HEAD`,

  /** Get commit log from merge base to HEAD */
  commitLog: (mergeBase: string) => `git log ${mergeBase}..HEAD --oneline`,

  /** Get list of changed files with status */
  diffNameStatus: (mergeBase: string) => `git diff --name-status ${mergeBase}..HEAD`,
} as const;

// =============================================================================
// Parsing Functions
// =============================================================================

/**
 * Parse git diff --numstat output into structured data.
 *
 * Format: "added\tremoved\tfilename" per line
 * Binary files show as "-\t-\tfilename"
 *
 * @param numstatOutput - Raw output from git diff --numstat
 * @returns Array of changed files with stats
 */
export function parseNumstat(numstatOutput: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const lines = numstatOutput.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    const [added, removed, path] = line.split('\t');

    // Binary files show as "-" for added/removed
    const linesAdded = added === '-' ? 0 : parseInt(added, 10);
    const linesRemoved = removed === '-' ? 0 : parseInt(removed, 10);

    // Determine change type based on line changes
    // Note: This is a heuristic. For accurate type, use --name-status
    let changeType: ChangedFile['changeType'] = 'modified';
    if (linesRemoved === 0 && linesAdded > 0) {
      // Could be new file or pure addition - conservative: modified
      changeType = 'modified';
    }

    files.push({
      path,
      changeType,
      linesAdded,
      linesRemoved,
    });
  }

  return files;
}

/**
 * Parse git diff --name-status output for accurate change types.
 *
 * Format: "STATUS\tfilename" or "R100\told\tnew" for renames
 * Status codes: A=added, M=modified, D=deleted, R=renamed
 *
 * @param nameStatusOutput - Raw output from git diff --name-status
 * @returns Map of file path to change type
 */
export function parseNameStatus(
  nameStatusOutput: string
): Map<string, { type: ChangedFile['changeType']; newPath?: string }> {
  const result = new Map<string, { type: ChangedFile['changeType']; newPath?: string }>();
  const lines = nameStatusOutput.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    const parts = line.split('\t');
    const status = parts[0];

    if (status.startsWith('R')) {
      // Rename: R100\told-path\tnew-path
      const [oldPath, newPath] = parts.slice(1);
      result.set(oldPath, { type: 'renamed', newPath });
    } else if (status === 'A') {
      result.set(parts[1], { type: 'added' });
    } else if (status === 'D') {
      result.set(parts[1], { type: 'deleted' });
    } else {
      // M and any other status treated as modified
      result.set(parts[1], { type: 'modified' });
    }
  }

  return result;
}

/**
 * Parse git log --oneline output into commit objects.
 *
 * Format: "sha message" per line
 *
 * @param logOutput - Raw output from git log --oneline
 * @returns Array of commit objects
 */
export function parseCommitLog(logOutput: string): BranchCommit[] {
  const commits: BranchCommit[] = [];
  const lines = logOutput.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    const spaceIndex = line.indexOf(' ');
    if (spaceIndex > 0) {
      commits.push({
        sha: line.substring(0, spaceIndex),
        message: line.substring(spaceIndex + 1),
      });
    }
  }

  return commits;
}

/**
 * Calculate aggregate diff statistics from file changes.
 *
 * @param files - Array of changed files
 * @returns Aggregated statistics
 */
export function calculateStats(files: ChangedFile[]): DiffStats {
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const file of files) {
    linesAdded += file.linesAdded;
    linesRemoved += file.linesRemoved;
  }

  return {
    filesChanged: files.length,
    linesAdded,
    linesRemoved,
    netChange: linesAdded - linesRemoved,
  };
}

/**
 * Merge numstat data with name-status data for complete file info.
 *
 * Numstat gives us line counts, name-status gives us accurate change types.
 *
 * @param numstatFiles - Files from parseNumstat
 * @param nameStatusMap - Map from parseNameStatus
 * @returns Complete file information
 */
export function mergeFileData(
  numstatFiles: ChangedFile[],
  nameStatusMap: Map<string, { type: ChangedFile['changeType']; newPath?: string }>
): ChangedFile[] {
  return numstatFiles.map(file => {
    const statusInfo = nameStatusMap.get(file.path);
    if (statusInfo) {
      return {
        ...file,
        changeType: statusInfo.type,
        newPath: statusInfo.newPath,
      };
    }
    return file;
  });
}

// =============================================================================
// High-Level Extraction
// =============================================================================

/**
 * Determines the recommended number of questions based on diff size.
 *
 * This function implements the scaling logic described in the skill spec:
 * - Small diff (1-50 lines): 2-3 questions
 * - Medium diff (50-200 lines): 4-6 questions
 * - Large diff (200-500 lines): 6-8 questions
 * - Very large diff (500+ lines): 8-10 questions
 *
 * @param stats - Diff statistics
 * @param minQuestions - Minimum questions (from config)
 * @param maxQuestions - Maximum questions (from config)
 * @returns Recommended number of questions
 */
export function calculateQuestionCount(
  stats: DiffStats,
  minQuestions: number = 2,
  maxQuestions: number = 10
): number {
  const totalLines = stats.linesAdded + stats.linesRemoved;

  let recommended: number;

  if (totalLines <= 50) {
    recommended = 2;
  } else if (totalLines <= 200) {
    recommended = 4 + Math.floor((totalLines - 50) / 50); // 4-6
  } else if (totalLines <= 500) {
    recommended = 6 + Math.floor((totalLines - 200) / 150); // 6-8
  } else {
    recommended = 8 + Math.min(2, Math.floor((totalLines - 500) / 250)); // 8-10
  }

  return Math.max(minQuestions, Math.min(maxQuestions, recommended));
}

/**
 * Calculates a complexity score (0-100) for the diff.
 *
 * Factors considered:
 * - Number of files changed (more files = more complex)
 * - Total lines changed
 * - Ratio of additions to deletions (balanced changes often mean refactoring)
 * - Presence of certain file patterns (config, tests, etc.)
 *
 * @param files - Changed files
 * @param stats - Diff statistics
 * @returns Complexity score 0-100
 */
export function calculateComplexity(files: ChangedFile[], stats: DiffStats): number {
  let score = 0;

  // File count factor (0-25 points)
  score += Math.min(25, files.length * 2.5);

  // Lines changed factor (0-25 points)
  const totalLines = stats.linesAdded + stats.linesRemoved;
  score += Math.min(25, totalLines / 20);

  // File type diversity factor (0-25 points)
  const extensions = new Set(files.map(f => f.path.split('.').pop() || ''));
  score += Math.min(25, extensions.size * 5);

  // Churn factor - high remove/add ratio suggests refactoring (0-25 points)
  if (stats.linesAdded > 0) {
    const churnRatio = stats.linesRemoved / stats.linesAdded;
    score += Math.min(25, churnRatio * 15);
  }

  return Math.min(100, Math.round(score));
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates that the repository is in a valid state for diff analysis.
 *
 * @param context - Git context to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateContext(
  context: GitContext
): { isValid: boolean; error?: string } {
  if (context.error) {
    return { isValid: false, error: context.error };
  }

  if (!context.currentBranch) {
    return { isValid: false, error: 'Could not determine current branch' };
  }

  if (context.currentBranch === context.defaultBranch) {
    return {
      isValid: false,
      error: `Already on ${context.defaultBranch} branch. Switch to a feature branch to analyze changes.`
    };
  }

  if (!context.hasChanges) {
    return {
      isValid: false,
      error: `No changes found between current branch and ${context.defaultBranch}. Nothing to analyze.`
    };
  }

  return { isValid: true };
}
