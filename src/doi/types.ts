/**
 * Type definitions for the /doi skill.
 *
 * These types define the data structures used throughout the skill,
 * ensuring consistent data flow between modules and enabling future
 * extensions (like a "resolve vibe debt" skill).
 */

// =============================================================================
// Git Context Types
// =============================================================================

/**
 * Represents the current Git context extracted from the repository.
 * This is the entry point for all diff analysis.
 */
export interface GitContext {
  /** Current branch name (e.g., "feature/add-auth") */
  currentBranch: string;

  /** Default branch detected from remote (e.g., "main", "master", "develop") */
  defaultBranch: string;

  /** SHA of the merge base (common ancestor) */
  mergeBase: string;

  /** Whether there are any changes to analyze */
  hasChanges: boolean;

  /** Error message if git context couldn't be extracted */
  error?: string;
}

/**
 * Statistics about the changes in the diff.
 */
export interface DiffStats {
  /** Total number of files changed */
  filesChanged: number;

  /** Total lines added */
  linesAdded: number;

  /** Total lines removed */
  linesRemoved: number;

  /** Net change (added - removed) */
  netChange: number;
}

/**
 * Represents a single changed file in the diff.
 */
export interface ChangedFile {
  /** File path relative to repository root */
  path: string;

  /** Type of change */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';

  /** Lines added in this file */
  linesAdded: number;

  /** Lines removed in this file */
  linesRemoved: number;

  /** New path if file was renamed */
  newPath?: string;
}

/**
 * A commit on the current branch (not on main).
 */
export interface BranchCommit {
  /** Short SHA */
  sha: string;

  /** Commit message (first line) */
  message: string;
}

/**
 * Complete diff data extracted from git.
 */
export interface GitDiff {
  /** Git context information */
  context: GitContext;

  /** Raw diff output */
  rawDiff: string;

  /** Parsed file changes */
  files: ChangedFile[];

  /** Overall statistics */
  stats: DiffStats;

  /** Commits on this branch */
  commits: BranchCommit[];
}

// =============================================================================
// Analysis Types
// =============================================================================

/**
 * Categories of changes detected in the diff.
 */
export type ChangeCategory =
  | 'new-feature'      // New functionality added
  | 'modified-logic'   // Changes to existing behavior
  | 'refactoring'      // Restructuring without behavior change
  | 'deletion'         // Removed code
  | 'configuration'    // Config, build, dependency changes
  | 'documentation'    // Doc changes
  | 'testing';         // Test additions/changes

/**
 * A categorized change in the diff.
 */
export interface CategorizedChange {
  /** The category of this change */
  category: ChangeCategory;

  /** Human-readable description */
  description: string;

  /** Files involved in this change */
  files: string[];
}

/**
 * High-level summary of the diff for human consumption.
 */
export interface DiffSummary {
  /** One-sentence overview of what this branch does */
  overview: string;

  /** Changes organized by category */
  changes: CategorizedChange[];

  /** Inferred intent/purpose of the branch */
  inferredIntent: string;

  /** Key files that are most important to understand */
  keyFiles: string[];

  /** Diff statistics */
  stats: DiffStats;

  /** List of all files changed */
  filesChanged: string[];
}

// =============================================================================
// Question Types
// =============================================================================

/**
 * Types of comprehension questions.
 */
export type QuestionCategory =
  | 'why'       // Purpose behind a change
  | 'how'       // Mechanism of implementation
  | 'what-if'   // Edge cases and error handling
  | 'impact';   // Effects on other parts of codebase

/**
 * A code snippet to show when explaining an answer.
 */
export interface CodeSnippet {
  /** The code to display */
  code: string;

  /** Programming language for syntax highlighting */
  language: string;

  /** Brief description of what this code shows */
  description: string;
}

/**
 * A single multiple-choice question.
 */
export interface MCQuestion {
  /** Unique identifier for this question */
  id: string;

  /** The question text */
  question: string;

  /** The four answer options */
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };

  /** Which option is correct */
  correctAnswer: 'A' | 'B' | 'C' | 'D';

  /** Explanation of why the correct answer is correct */
  explanation: string;

  /** Category of this question */
  category: QuestionCategory;

  /** Files this question relates to */
  relatedFiles: string[];

  /** Difficulty level (for future use) */
  difficulty: 'easy' | 'medium' | 'hard';

  /** Code snippet to show when explaining (optional) */
  codeSnippet?: CodeSnippet;
}

/**
 * Generated question set for a diff.
 */
export interface QuestionSet {
  /** All generated questions */
  questions: MCQuestion[];

  /** Recommended number of questions based on diff size */
  recommendedCount: number;

  /** Diff complexity score (0-100) */
  complexityScore: number;
}

// =============================================================================
// Quiz Session Types
// =============================================================================

/**
 * Status of a question after user interaction.
 */
export type QuestionStatus = 'pending' | 'correct' | 'incorrect' | 'skipped' | 'revealed';

/**
 * Result of answering a single question.
 */
export interface QuestionResult {
  /** The question that was answered */
  question: MCQuestion;

  /** Status after user interaction */
  status: QuestionStatus;

  /** User's selected answer (if any) */
  userAnswer: 'A' | 'B' | 'C' | 'D' | null;
}

/**
 * Complete quiz session results.
 */
export interface QuizSession {
  /** Branch this quiz was for */
  branchName: string;

  /** When the quiz was taken */
  date: string;

  /** Results for each question */
  results: QuestionResult[];

  /** Summary statistics */
  stats: QuizStats;
}

/**
 * Statistics about quiz performance.
 */
export interface QuizStats {
  /** Total questions presented */
  totalQuestions: number;

  /** Questions answered correctly */
  correct: number;

  /** Questions answered incorrectly */
  incorrect: number;

  /** Questions skipped */
  skipped: number;

  /** Vibe debt percentage (0-100) */
  vibeDebtPercent: number;
}

// =============================================================================
// Vibe Debt Storage Types
// =============================================================================

/**
 * A question that became vibe debt (skipped or incorrect).
 */
export interface VibeDebtQuestion {
  /** Question ID */
  id: string;

  /** The question text */
  question: string;

  /** Answer options */
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };

  /** Correct answer */
  correctAnswer: 'A' | 'B' | 'C' | 'D';

  /** Explanation */
  explanation: string;

  /** Why this is debt: skipped, answered wrong, or revealed */
  status: 'skipped' | 'incorrect' | 'revealed';

  /** What the user answered (null if skipped or revealed) */
  userAnswer: 'A' | 'B' | 'C' | 'D' | null;

  /** Related files */
  relatedFiles: string[];

  /** Question category */
  category: QuestionCategory;
}

/**
 * Stored vibe debt for a branch.
 * This is the format written to VibeDebt/<branch>_<date>.json
 */
export interface VibeDebtRecord {
  /** Branch name this debt is for */
  branchName: string;

  /** Date of the quiz (YYYY-MM-DD) */
  date: string;

  /** Summary of what was changed */
  diffSummary: {
    overview: string;
    filesChanged: string[];
    linesAdded: number;
    linesRemoved: number;
  };

  /** Questions that became debt */
  vibeDebt: VibeDebtQuestion[];

  /** Quiz statistics */
  stats: QuizStats;

  /** Schema version for future compatibility */
  schemaVersion: 1;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration options for the /doi skill.
 */
export interface DoiConfig {
  /** Main branch name (default: auto-detect) */
  mainBranch?: string;

  /** Minimum questions to generate */
  minQuestions: number;

  /** Maximum questions to generate */
  maxQuestions: number;

  /** Path to store vibe debt (default: "./VibeDebt") */
  vibeDebtPath: string;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: DoiConfig = {
  minQuestions: 2,
  maxQuestions: 10,
  vibeDebtPath: './VibeDebt',
};
