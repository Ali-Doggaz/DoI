/**
 * Vibe Debt Persistence Module
 *
 * This module handles saving and loading vibe debt records.
 * Vibe debt consists of questions that were skipped or answered incorrectly,
 * stored locally for later review.
 *
 * Design Decision: All storage is local and file-based. No external
 * services or uploads. Data stays in the user's project directory.
 */

import type {
  VibeDebtRecord,
  VibeDebtQuestion,
  MCQuestion,
  QuestionResult,
  DiffSummary,
  QuizStats
} from '../types';

// =============================================================================
// File Naming
// =============================================================================

/**
 * Generates a vibe debt filename from branch name and date.
 *
 * Format: <sanitized-branch-name>_<YYYY-MM-DD>.json
 *
 * Branch names are sanitized to remove characters that are
 * problematic in filenames.
 *
 * @param branchName - Git branch name
 * @param date - Date object (defaults to now)
 * @returns Sanitized filename
 */
export function generateFilename(
  branchName: string,
  date: Date = new Date()
): string {
  // Sanitize branch name for use in filename
  const sanitized = branchName
    .replace(/[\/\\:*?"<>|]/g, '-') // Replace filesystem-unsafe chars
    .replace(/^-+|-+$/g, '')         // Trim leading/trailing dashes
    .replace(/-{2,}/g, '-');         // Collapse multiple dashes

  // Format date as YYYY-MM-DD
  const dateStr = date.toISOString().split('T')[0];

  return `${sanitized}_${dateStr}.json`;
}

/**
 * Gets the default vibe debt directory path.
 *
 * @param projectRoot - Root of the project (usually cwd)
 * @returns Path to VibeDebt directory
 */
export function getVibeDebtDir(projectRoot: string = '.'): string {
  return `${projectRoot}/VibeDebt`;
}

/**
 * Gets the full path for a vibe debt file.
 *
 * @param branchName - Git branch name
 * @param projectRoot - Root of the project
 * @param date - Date for the filename
 * @returns Full path to the vibe debt file
 */
export function getVibeDebtPath(
  branchName: string,
  projectRoot: string = '.',
  date: Date = new Date()
): string {
  const dir = getVibeDebtDir(projectRoot);
  const filename = generateFilename(branchName, date);
  return `${dir}/${filename}`;
}

// =============================================================================
// Record Creation
// =============================================================================

/**
 * Converts a QuestionResult to a VibeDebtQuestion.
 * Only called for questions that became debt (skipped or incorrect).
 */
function toVibeDebtQuestion(result: QuestionResult): VibeDebtQuestion {
  const { question, status, userAnswer } = result;

  return {
    id: question.id,
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    status: status as 'skipped' | 'incorrect', // Already filtered
    userAnswer: userAnswer,
    relatedFiles: question.relatedFiles,
    category: question.category,
  };
}

/**
 * Creates a VibeDebtRecord from quiz results.
 *
 * @param branchName - Name of the branch
 * @param summary - Diff summary
 * @param results - All question results
 * @param stats - Quiz statistics
 * @returns Complete vibe debt record
 */
export function createVibeDebtRecord(
  branchName: string,
  summary: DiffSummary,
  results: QuestionResult[],
  stats: QuizStats
): VibeDebtRecord {
  // Filter to only debt questions (skipped or incorrect)
  const debtQuestions = results
    .filter(r => r.status === 'skipped' || r.status === 'incorrect')
    .map(toVibeDebtQuestion);

  return {
    branchName,
    date: new Date().toISOString().split('T')[0],
    diffSummary: {
      overview: summary.overview,
      filesChanged: summary.filesChanged,
      linesAdded: summary.stats.linesAdded,
      linesRemoved: summary.stats.linesRemoved,
    },
    vibeDebt: debtQuestions,
    stats,
    schemaVersion: 1,
  };
}

// =============================================================================
// JSON Serialization
// =============================================================================

/**
 * Serializes a VibeDebtRecord to a formatted JSON string.
 *
 * Uses 2-space indentation for readability.
 */
export function serializeRecord(record: VibeDebtRecord): string {
  return JSON.stringify(record, null, 2);
}

/**
 * Parses a JSON string into a VibeDebtRecord.
 *
 * @param json - JSON string to parse
 * @returns Parsed record
 * @throws Error if JSON is invalid or doesn't match schema
 */
export function parseRecord(json: string): VibeDebtRecord {
  const parsed = JSON.parse(json);

  // Basic validation
  if (!parsed.branchName || !parsed.date || !parsed.vibeDebt) {
    throw new Error('Invalid VibeDebtRecord: missing required fields');
  }

  // Version check for future compatibility
  if (parsed.schemaVersion && parsed.schemaVersion > 1) {
    console.warn(
      `VibeDebtRecord has newer schema version (${parsed.schemaVersion}). ` +
      'Some features may not work correctly.'
    );
  }

  return parsed as VibeDebtRecord;
}

// =============================================================================
// Bash Commands for Storage
// =============================================================================

/**
 * Bash command templates for file operations.
 * Used in the skill definition for actual file I/O.
 */
export const STORAGE_COMMANDS = {
  /** Create the VibeDebt directory if it doesn't exist */
  createDir: (projectRoot: string = '.') =>
    `mkdir -p "${getVibeDebtDir(projectRoot)}"`,

  /** Check if VibeDebt directory exists */
  checkDir: (projectRoot: string = '.') =>
    `test -d "${getVibeDebtDir(projectRoot)}" && echo "exists" || echo "missing"`,

  /** List existing vibe debt files */
  listFiles: (projectRoot: string = '.') =>
    `ls -la "${getVibeDebtDir(projectRoot)}" 2>/dev/null || echo "No vibe debt files"`,

  /** Write record to file (content is piped in) */
  writeFile: (path: string) =>
    `cat > "${path}"`,

  /** Read a vibe debt file */
  readFile: (path: string) =>
    `cat "${path}"`,
};

/**
 * Instructions for the skill to write vibe debt.
 * Embedded in the skill definition.
 */
export const WRITE_INSTRUCTIONS = `
To save Vibe Debt:

1. Create the directory:
   \`\`\`bash
   mkdir -p VibeDebt
   \`\`\`

2. Generate the filename:
   - Sanitize branch name (replace /\\:*?"<>| with -)
   - Format: <branch-name>_<YYYY-MM-DD>.json

3. Use the Write tool to create the JSON file with this structure:
   \`\`\`json
   {
     "branchName": "feature/my-branch",
     "date": "2024-01-15",
     "diffSummary": {
       "overview": "...",
       "filesChanged": ["..."],
       "linesAdded": 123,
       "linesRemoved": 45
     },
     "vibeDebt": [
       {
         "id": "q_why_1",
         "question": "...",
         "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
         "correctAnswer": "B",
         "explanation": "...",
         "status": "skipped",
         "userAnswer": null,
         "relatedFiles": ["..."],
         "category": "why"
       }
     ],
     "stats": {
       "totalQuestions": 5,
       "correct": 2,
       "incorrect": 1,
       "skipped": 2,
       "vibeDebtPercent": 60
     },
     "schemaVersion": 1
   }
   \`\`\`
`;

// =============================================================================
// Gitignore Handling
// =============================================================================

/**
 * Suggested .gitignore entry for VibeDebt.
 *
 * By default, we suggest tracking vibe debt in git so the whole team
 * can see it. But users may want to ignore it.
 */
export const GITIGNORE_SUGGESTION = `
# Uncomment to ignore personal vibe debt
# VibeDebt/
`;

/**
 * Checks if VibeDebt should be added to .gitignore.
 * Returns the entry to add if needed.
 */
export function getGitignoreEntry(ignore: boolean = false): string | null {
  if (ignore) {
    return 'VibeDebt/';
  }
  return null;
}
