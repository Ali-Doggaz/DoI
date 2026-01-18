/**
 * Question Generation Module
 *
 * This module generates multiple-choice comprehension questions based on
 * diff analysis. Questions test real understanding of changes:
 * - Why changes were made
 * - How implementations work
 * - Edge cases and tradeoffs
 * - Impact on existing behavior
 *
 * Design Decision: This module provides templates and guidelines for
 * question generation rather than actually generating questions, since
 * question generation requires LLM capabilities. Claude will use these
 * templates when the skill is invoked.
 */

import type {
  MCQuestion,
  QuestionCategory,
  QuestionSet,
  DiffSummary,
  CategorizedChange,
  DiffStats
} from '../types';

// =============================================================================
// Question Templates
// =============================================================================

/**
 * Templates for generating questions of different categories.
 * These provide structure for Claude to fill in with specific details.
 */
export const QUESTION_TEMPLATES: Record<QuestionCategory, string[]> = {
  'why': [
    'Why was {change} implemented in {file}?',
    'What problem does the {feature} solve?',
    'Why was {oldApproach} replaced with {newApproach}?',
    'What is the primary motivation for adding {component}?',
    'Why is {configuration} set to {value}?',
  ],
  'how': [
    'How does {function} handle {scenario}?',
    'How does the {component} interact with {dependency}?',
    'How is {data} transformed in {process}?',
    'How does {feature} ensure {property}?',
    'How does the error handling work in {module}?',
  ],
  'what-if': [
    'What happens if {input} is {edge_case}?',
    'What would occur if {dependency} fails?',
    'What is the behavior when {condition}?',
    'What happens to {state} when {event} occurs?',
    'What would change if {configuration} was different?',
  ],
  'impact': [
    'How does this change affect {existingFeature}?',
    'What parts of the codebase depend on {component}?',
    'What would break if {function} was removed?',
    'How does this change impact {userAction}?',
    'What side effects does {change} have on {system}?',
  ],
};

/**
 * Guidelines for generating distractors (wrong answers).
 * Good distractors are plausible but incorrect.
 */
export const DISTRACTOR_GUIDELINES = {
  // Common misconception patterns
  misconceptions: [
    'Confusing similar concepts (e.g., authentication vs authorization)',
    'Reversing cause and effect',
    'Assuming simpler implementation than actual',
    'Confusing synchronous vs asynchronous behavior',
    'Mixing up input and output',
  ],

  // Patterns for plausible wrong answers
  patterns: [
    'Partially correct but missing key detail',
    'Correct for a different context',
    'Technically possible but not what the code does',
    'Common assumption that the code explicitly avoids',
    'Valid alternative approach that wasn\'t chosen',
  ],

  // Things to avoid in distractors
  avoid: [
    'Obviously wrong answers',
    'Answers that are too similar to each other',
    'Technically impossible scenarios',
    'Answers much longer or shorter than the correct one',
    'Using different tense or style than correct answer',
  ],
};

// =============================================================================
// Question Count Calculation
// =============================================================================

/**
 * Determines appropriate question count based on diff complexity.
 *
 * Factors:
 * - Total lines changed
 * - Number of files
 * - Variety of change types
 * - Presence of logic changes vs config-only
 */
export function calculateRecommendedQuestionCount(
  summary: DiffSummary,
  minQuestions: number = 2,
  maxQuestions: number = 10
): number {
  const { stats, changes, filesChanged } = summary;
  const totalLines = stats.linesAdded + stats.linesRemoved;

  // Base count from line changes
  let count: number;
  if (totalLines <= 50) {
    count = 2;
  } else if (totalLines <= 200) {
    count = Math.min(6, 3 + Math.floor((totalLines - 50) / 50));
  } else if (totalLines <= 500) {
    count = Math.min(8, 5 + Math.floor((totalLines - 200) / 100));
  } else {
    count = Math.min(10, 7 + Math.floor((totalLines - 500) / 200));
  }

  // Adjust for number of files
  if (filesChanged.length > 10) {
    count = Math.min(count + 1, maxQuestions);
  }

  // Adjust for logic changes (more questions for actual code changes)
  const hasLogicChanges = changes.some(
    c => c.category === 'new-feature' || c.category === 'modified-logic'
  );
  if (!hasLogicChanges) {
    count = Math.max(minQuestions, Math.floor(count * 0.6));
  }

  return Math.max(minQuestions, Math.min(maxQuestions, count));
}

/**
 * Calculates a complexity score (0-100) for question generation purposes.
 */
export function calculateComplexityScore(summary: DiffSummary): number {
  let score = 0;

  // Lines changed factor (0-30)
  const totalLines = summary.stats.linesAdded + summary.stats.linesRemoved;
  score += Math.min(30, totalLines / 20);

  // Files changed factor (0-20)
  score += Math.min(20, summary.filesChanged.length * 2);

  // Change variety factor (0-25)
  const categories = new Set(summary.changes.map(c => c.category));
  score += categories.size * 5;

  // Key files factor - more key files = more to understand (0-25)
  score += Math.min(25, summary.keyFiles.length * 5);

  return Math.min(100, Math.round(score));
}

// =============================================================================
// Question Distribution
// =============================================================================

/**
 * Determines how many questions of each category to generate.
 * Ensures a good mix of question types.
 */
export function distributeQuestionCategories(
  totalQuestions: number,
  summary: DiffSummary
): Record<QuestionCategory, number> {
  const distribution: Record<QuestionCategory, number> = {
    'why': 0,
    'how': 0,
    'what-if': 0,
    'impact': 0,
  };

  // Analyze what types of changes we have
  const hasNewFeatures = summary.changes.some(c => c.category === 'new-feature');
  const hasModifiedLogic = summary.changes.some(c => c.category === 'modified-logic');
  const hasDeletions = summary.changes.some(c => c.category === 'deletion');
  const hasRefactoring = summary.changes.some(c => c.category === 'refactoring');

  // Distribute based on change types
  let remaining = totalQuestions;

  // Always have at least one "why" question
  distribution['why'] = Math.ceil(totalQuestions * 0.25);
  remaining -= distribution['why'];

  // "How" questions for new features and modifications
  if (hasNewFeatures || hasModifiedLogic) {
    distribution['how'] = Math.ceil(remaining * 0.4);
    remaining -= distribution['how'];
  }

  // "What-if" for complex logic
  if (hasModifiedLogic || hasNewFeatures) {
    distribution['what-if'] = Math.ceil(remaining * 0.5);
    remaining -= distribution['what-if'];
  }

  // "Impact" for refactoring and deletions
  if (hasRefactoring || hasDeletions || hasModifiedLogic) {
    distribution['impact'] = remaining;
  } else {
    // Distribute remaining to "how"
    distribution['how'] += remaining;
  }

  return distribution;
}

// =============================================================================
// Question Generation Guidelines
// =============================================================================

/**
 * Guidelines for including code snippets with question explanations.
 */
export const CODE_SNIPPET_GUIDELINES = `
## Code Snippet Guidelines

When generating questions, also prepare a relevant code snippet for the explanation:

### When to Include Snippets
- For "how" questions: Show the implementation
- For "why" questions: Show the code that demonstrates the reason
- For "what-if" questions: Show the edge case handling
- For "impact" questions: Show the affected code

### Snippet Format
- Keep snippets concise (5-15 lines ideally)
- Include just enough context to understand
- Use the correct language for syntax highlighting

### When NOT to Include
- Simple config changes
- Questions about overall architecture
- When the answer is conceptual, not code-based
`;

/**
 * Guidelines for Claude when generating questions during skill execution.
 * These are embedded in the skill definition as instructions.
 */
export const QUESTION_GENERATION_GUIDELINES = `
## Question Generation Guidelines

**IMPORTANT: Generate ALL questions upfront before starting the quiz.**

For each question, prepare:
1. The question text
2. Four answer options (A, B, C, D)
3. The correct answer
4. A detailed explanation
5. A code snippet (when applicable) showing relevant code from the diff

### Question Quality
1. Each question must be answerable ONLY from the diff content
2. Questions should test understanding, not memorization
3. Avoid trivial questions like "What file was changed?"
4. Focus on the "why" and "how" of changes

### Correct Answers
1. Must be unambiguously correct based on the code
2. Should be concise but complete
3. Avoid "All of the above" or "None of the above"

### Distractors (Wrong Answers)
1. Generate exactly 3 distractors (we use 4 options: A, B, C, D)
2. Must be plausible - they should seem reasonable
3. Should represent common misconceptions
4. Keep similar length and style to correct answer
5. Don't make them obviously wrong

### Question Categories
Aim for this distribution:
- WHY (25%): Purpose and motivation
- HOW (35%): Implementation details
- WHAT-IF (20%): Edge cases and error handling
- IMPACT (20%): Effects on other code

### Code Snippet Guidelines
For each question, prepare a code snippet when applicable:
- For "how" questions: Show the implementation
- For "why" questions: Show the code that demonstrates the reason
- For "what-if" questions: Show the edge case handling
- For "impact" questions: Show the affected code

Format:
\`\`\`
{
  "codeSnippet": {
    "code": "function example() { ... }",
    "language": "typescript",
    "description": "This shows how the validation works"
  }
}
\`\`\`

### Example Good Question
Based on a change adding input validation:

**Question**: Why does the validateEmail function reject addresses with plus signs in the local part?

A) Plus signs are invalid in email addresses according to RFC 5321
B) The legacy database cannot store plus sign characters
C) It prevents email subaddressing which could bypass rate limits
D) JavaScript's regex engine doesn't support plus sign matching

**Correct**: C (if this is what the code comments or context suggests)
**Why others are wrong**:
- A: Plus signs ARE valid per RFC 5321
- B: No evidence of database limitations in the diff
- D: JS regex definitely supports plus signs

**Code Snippet** (to show with explanation):
\`\`\`typescript
function validateEmail(email: string): boolean {
  // Reject plus signs to prevent rate limit bypass via subaddressing
  if (email.includes('+')) {
    return false;
  }
  return EMAIL_REGEX.test(email);
}
\`\`\`

### Example Bad Question
**Question**: What function was added?

A) validateEmail
B) checkEmail
C) verifyEmail
D) testEmail

**Why it's bad**: Tests memorization, not understanding
`;

// =============================================================================
// Question ID Generation
// =============================================================================

/**
 * Generates a unique ID for a question.
 * Format: q_<category>_<index>
 */
export function generateQuestionId(
  category: QuestionCategory,
  index: number
): string {
  return `q_${category}_${index}`;
}

// =============================================================================
// Stub for Question Generation
// =============================================================================

/**
 * Creates an empty question set structure.
 *
 * Note: Actual question generation is done by Claude during skill execution.
 * This function provides the structure for consistency.
 */
export function createEmptyQuestionSet(summary: DiffSummary): QuestionSet {
  const recommendedCount = calculateRecommendedQuestionCount(summary);
  const complexityScore = calculateComplexityScore(summary);

  return {
    questions: [], // Filled by Claude during skill execution
    recommendedCount,
    complexityScore,
  };
}
