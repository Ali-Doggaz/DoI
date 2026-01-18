/**
 * Interactive UI Module
 *
 * This module defines the interaction patterns for the quiz experience.
 * It provides structures and templates for presenting questions using
 * Claude Code's AskUserQuestion tool.
 *
 * Design Decision: Since the actual UI is rendered by Claude Code's
 * tool infrastructure, this module defines the data formats and
 * interaction patterns rather than implementing UI directly.
 */

import type {
  MCQuestion,
  QuestionResult,
  QuizStats,
  QuestionStatus
} from '../types';

// =============================================================================
// Question Presentation
// =============================================================================

/**
 * Format for presenting a question via AskUserQuestion tool.
 *
 * The skill will transform MCQuestion into this format for the tool call.
 */
export interface QuestionPresentation {
  /** The question text with number prefix */
  questionText: string;

  /** Header for the question (shown as chip) */
  header: string;

  /** Options for the question */
  options: Array<{
    label: string;
    description: string;
  }>;
}

/**
 * Formats a question for presentation to the user.
 *
 * @param question - The MCQ to format
 * @param questionNumber - 1-indexed question number
 * @param totalQuestions - Total number of questions
 * @returns Formatted presentation data
 */
export function formatQuestionForPresentation(
  question: MCQuestion,
  questionNumber: number,
  totalQuestions: number
): QuestionPresentation {
  return {
    questionText: `Question ${questionNumber}/${totalQuestions}: ${question.question}`,
    header: `Q${questionNumber}`,
    options: [
      { label: 'A', description: question.options.A },
      { label: 'B', description: question.options.B },
      { label: 'C', description: question.options.C },
      { label: 'D', description: question.options.D },
      { label: 'Skip All', description: 'Skip remaining questions (saves as Vibe Debt)' },
    ],
  };
}

/**
 * Template for AskUserQuestion tool call.
 * Used in the skill definition to show the expected format.
 */
export const ASK_USER_QUESTION_TEMPLATE = `
Use AskUserQuestion with this structure for each quiz question:

{
  "questions": [{
    "question": "Question N/M: <question text>",
    "header": "QN",
    "multiSelect": false,
    "options": [
      { "label": "A", "description": "<option A text>" },
      { "label": "B", "description": "<option B text>" },
      { "label": "C", "description": "<option C text>" },
      { "label": "D", "description": "<option D text>" },
      { "label": "Skip All", "description": "Skip remaining questions (saves as Vibe Debt)" }
    ]
  }]
}

After the user selects an answer:
- If A/B/C/D: Compare to correct answer and show feedback
- If Skip All: Immediately proceed to save remaining questions as Vibe Debt
- If Other: Treat as a request for clarification
`;

// =============================================================================
// Answer Feedback
// =============================================================================

/**
 * Generates feedback text for a question result.
 *
 * @param question - The answered question
 * @param userAnswer - What the user selected
 * @param isCorrect - Whether they got it right
 * @returns Feedback message to display
 */
export function generateFeedback(
  question: MCQuestion,
  userAnswer: 'A' | 'B' | 'C' | 'D',
  isCorrect: boolean
): string {
  if (isCorrect) {
    return `Correct! ${question.explanation}`;
  }

  return `Not quite. The correct answer is ${question.correctAnswer}: "${question.options[question.correctAnswer]}". ${question.explanation}`;
}

/**
 * Feedback message templates for different scenarios.
 */
export const FEEDBACK_TEMPLATES = {
  correct: (explanation: string) =>
    `Correct! ${explanation}`,

  incorrect: (correctAnswer: string, correctText: string, explanation: string) =>
    `Not quite. The correct answer is ${correctAnswer}: "${correctText}". ${explanation}`,

  skipped: (remainingCount: number) =>
    `Skipped ${remainingCount} remaining question${remainingCount !== 1 ? 's' : ''}. These will be saved as Vibe Debt for later review.`,
};

// =============================================================================
// Progress Display
// =============================================================================

/**
 * Generates a progress indicator string.
 *
 * @param current - Current question number (1-indexed)
 * @param total - Total number of questions
 * @param stats - Current quiz stats
 * @returns Progress display string
 */
export function generateProgressDisplay(
  current: number,
  total: number,
  stats: Partial<QuizStats>
): string {
  const correct = stats.correct ?? 0;
  const incorrect = stats.incorrect ?? 0;
  const answered = correct + incorrect;

  const progressBar = generateProgressBar(answered, total);

  return `Progress: ${progressBar} ${answered}/${total} | Correct: ${correct} | Incorrect: ${incorrect}`;
}

/**
 * Creates a simple text progress bar.
 *
 * @param completed - Number of completed items
 * @param total - Total items
 * @param width - Width of the bar in characters
 * @returns ASCII progress bar string
 */
function generateProgressBar(
  completed: number,
  total: number,
  width: number = 20
): string {
  const filled = Math.round((completed / total) * width);
  const empty = width - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}

// =============================================================================
// Results Display
// =============================================================================

/**
 * Generates the final results summary.
 *
 * @param stats - Quiz statistics
 * @param branchName - Name of the analyzed branch
 * @param vibeDebtFile - Path to saved vibe debt (if any)
 * @returns Formatted results string
 */
export function generateResultsSummary(
  stats: QuizStats,
  branchName: string,
  vibeDebtFile?: string
): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('## Quiz Results');
  lines.push('');
  lines.push(`Branch: \`${branchName}\``);
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Questions | ${stats.totalQuestions} |`);
  lines.push(`| Correct | ${stats.correct} |`);
  lines.push(`| Incorrect | ${stats.incorrect} |`);
  lines.push(`| Skipped | ${stats.skipped} |`);
  lines.push('');
  lines.push(`**Vibe Debt Score: ${stats.vibeDebtPercent}%**`);
  lines.push('');
  lines.push(getScoreMessage(stats.vibeDebtPercent));

  if (vibeDebtFile) {
    lines.push('');
    lines.push(`Vibe Debt saved to: \`${vibeDebtFile}\``);
  }

  return lines.join('\n');
}

/**
 * Returns an encouraging message based on the vibe debt score.
 */
function getScoreMessage(vibeDebtPercent: number): string {
  if (vibeDebtPercent === 0) {
    return 'Perfect understanding! You own this code.';
  } else if (vibeDebtPercent <= 25) {
    return 'Great job! Minor gaps to review later.';
  } else if (vibeDebtPercent <= 50) {
    return 'Good start. Consider reviewing the saved questions.';
  } else if (vibeDebtPercent <= 75) {
    return 'Significant vibe debt. Schedule time to review.';
  } else {
    return 'High vibe debt. Review before merging recommended.';
  }
}

/**
 * Score message lookup table for the skill definition.
 */
export const SCORE_MESSAGES = {
  perfect: 'Perfect understanding! You own this code.',
  low: 'Great job! Minor gaps to review later.',
  moderate: 'Good start. Consider reviewing the saved questions.',
  significant: 'Significant vibe debt. Schedule time to review.',
  high: 'High vibe debt. Review before merging recommended.',
};

// =============================================================================
// Quiz Session Management
// =============================================================================

/**
 * Creates an initial quiz stats object.
 */
export function createInitialStats(totalQuestions: number): QuizStats {
  return {
    totalQuestions,
    correct: 0,
    incorrect: 0,
    skipped: 0,
    vibeDebtPercent: 0,
  };
}

/**
 * Updates quiz stats after a question is answered.
 */
export function updateStats(
  stats: QuizStats,
  result: QuestionStatus
): QuizStats {
  const updated = { ...stats };

  switch (result) {
    case 'correct':
      updated.correct += 1;
      break;
    case 'incorrect':
      updated.incorrect += 1;
      break;
    case 'skipped':
      updated.skipped += 1;
      break;
  }

  updated.vibeDebtPercent = Math.round(
    ((updated.incorrect + updated.skipped) / updated.totalQuestions) * 100
  );

  return updated;
}

/**
 * Marks all remaining questions as skipped.
 */
export function skipRemaining(
  stats: QuizStats,
  remainingCount: number
): QuizStats {
  return {
    ...stats,
    skipped: stats.skipped + remainingCount,
    vibeDebtPercent: Math.round(
      ((stats.incorrect + stats.skipped + remainingCount) / stats.totalQuestions) * 100
    ),
  };
}
