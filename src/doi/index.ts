/**
 * /doi Skill - Understand Your Vibe-Coded Changes
 *
 * This module serves as the main entry point for the /doi skill implementation.
 * It re-exports all public interfaces from the component modules.
 *
 * The /doi skill helps developers reduce "vibe debt" by:
 * 1. Extracting git diff between current branch and main
 * 2. Analyzing and summarizing the changes
 * 3. Generating comprehension questions
 * 4. Presenting an interactive quiz
 * 5. Storing unanswered questions as "vibe debt"
 *
 * Architecture Overview:
 * ----------------------
 * The skill is organized into focused modules:
 *
 * - types.ts: All TypeScript interfaces and types
 * - git/extract.ts: Git command execution and diff parsing
 * - analyzer/summarize.ts: Diff categorization and summarization
 * - questions/generate.ts: Question templates and generation logic
 * - ui/interactive.ts: Interactive quiz presentation
 * - storage/vibedebt.ts: Persistence of unanswered questions
 *
 * The skill definition (.claude/skills/doi.md) uses these modules
 * conceptually while executing via Claude Code's tool infrastructure.
 *
 * Usage:
 * ------
 * Invoke via Claude Code: /doi
 *
 * The skill will:
 * 1. Detect your current branch
 * 2. Compare against main/master
 * 3. Generate comprehension questions
 * 4. Present an interactive quiz
 * 5. Save vibe debt for skipped/incorrect questions
 *
 * @module doi
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Git types
  GitContext,
  GitDiff,
  DiffStats,
  ChangedFile,
  BranchCommit,

  // Analysis types
  ChangeCategory,
  CategorizedChange,
  DiffSummary,

  // Question types
  QuestionCategory,
  MCQuestion,
  QuestionSet,

  // Quiz types
  QuestionStatus,
  QuestionResult,
  QuizSession,
  QuizStats,

  // Storage types
  VibeDebtQuestion,
  VibeDebtRecord,

  // Config types
  DoiConfig,
} from './types';

export { DEFAULT_CONFIG } from './types';

// =============================================================================
// Git Module Exports
// =============================================================================

export {
  GIT_COMMANDS,
  parseNumstat,
  parseNameStatus,
  parseCommitLog,
  calculateStats,
  mergeFileData,
  calculateQuestionCount,
  calculateComplexity,
  validateContext,
} from './git/extract';

// =============================================================================
// Analyzer Module Exports
// =============================================================================

export {
  categorizeChanges,
  identifyKeyFiles,
  inferIntent,
  generateOverview,
  generateDiffSummary,
} from './analyzer/summarize';

// =============================================================================
// Questions Module Exports
// =============================================================================

export {
  QUESTION_TEMPLATES,
  DISTRACTOR_GUIDELINES,
  QUESTION_GENERATION_GUIDELINES,
  calculateRecommendedQuestionCount,
  calculateComplexityScore,
  distributeQuestionCategories,
  generateQuestionId,
  createEmptyQuestionSet,
} from './questions/generate';

// =============================================================================
// UI Module Exports
// =============================================================================

export {
  ASK_USER_QUESTION_TEMPLATE,
  FEEDBACK_TEMPLATES,
  SCORE_MESSAGES,
  formatQuestionForPresentation,
  generateFeedback,
  generateProgressDisplay,
  generateResultsSummary,
  createInitialStats,
  updateStats,
  skipRemaining,
} from './ui/interactive';

// =============================================================================
// Storage Module Exports
// =============================================================================

export {
  STORAGE_COMMANDS,
  WRITE_INSTRUCTIONS,
  GITIGNORE_SUGGESTION,
  generateFilename,
  getVibeDebtDir,
  getVibeDebtPath,
  createVibeDebtRecord,
  serializeRecord,
  parseRecord,
  getGitignoreEntry,
} from './storage/vibedebt';
