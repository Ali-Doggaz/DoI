# /doi - Understand Your Vibe-Coded Changes

Reduce "vibe debt" by ensuring you understand the code you vibe-coded on your current Git branch.

## When to Use
Invoke this skill with `/doi` when you want to:
- Verify your understanding of changes made on the current branch
- Generate comprehension questions about your code changes
- Track "vibe debt" (unanswered questions) for later review

## Behavior

When invoked, this skill will:

1. **Detect Git Context**
   - Identify the current branch name
   - Compare against the main integration branch (default: `main`)
   - Compute the git diff between main and current branch

2. **Analyze the Diff**
   - Summarize changes at a high level:
     - New features added
     - Modified logic
     - Deleted or refactored code
     - Config/infra changes
   - Infer intent where possible (without hallucinating)

3. **Generate Comprehension Questions**
   - Create multiple-choice questions (MCQs) testing real understanding
   - Questions focus on:
     - Why a change was made
     - How the code works
     - Edge cases and tradeoffs
     - Impact on existing behavior
   - Each question has 1 correct answer and 2-3 plausible distractors
   - Number of questions scales with diff size and complexity

4. **Interactive Quiz**
   - Present questions one at a time using Claude Code's interactive UI
   - User can answer each question or skip all remaining questions

5. **Track Vibe Debt**
   - If questions are skipped, persist them to `VibeDebt/<branch-name>_<YYYY-MM-DD>.json`
   - Data is fully local and never uploaded anywhere

## Instructions

Execute the following steps in order:

### Step 1: Extract Git Diff
Use the Bash tool to run these git commands and capture the output:

```bash
# Get current branch name
git rev-parse --abbrev-ref HEAD

# Get the main branch name (check if 'main' or 'master' exists)
git show-ref --verify --quiet refs/heads/main && echo "main" || (git show-ref --verify --quiet refs/heads/master && echo "master" || echo "main")

# Get the merge base (common ancestor)
git merge-base <main-branch> HEAD

# Get the full diff with context
git diff <merge-base>..HEAD

# Get list of changed files with stats
git diff --stat <merge-base>..HEAD

# Get commit messages on this branch
git log <merge-base>..HEAD --oneline
```

If the current branch IS the main branch, inform the user that there are no changes to analyze and exit gracefully.

If there are no changes in the diff, inform the user and exit gracefully.

### Step 2: Analyze the Diff
Based on the git diff output, create a structured summary:

1. **Overview**: Brief description of what this branch accomplishes
2. **Categories of Changes**:
   - New Features: New files, functions, or capabilities added
   - Modified Logic: Changes to existing behavior
   - Refactoring: Code restructuring without behavior changes
   - Deletions: Removed code or features
   - Configuration: Changes to config files, dependencies, build settings
3. **Key Files Changed**: List the most important files affected
4. **Inferred Intent**: What problem is this branch trying to solve?

Present this summary to the user before starting the quiz.

### Step 3: Generate Questions
Generate MCQ questions based on the diff analysis. Guidelines:

- **Question Count**: Scale with complexity
  - Small diff (1-50 lines): 2-3 questions
  - Medium diff (50-200 lines): 4-6 questions
  - Large diff (200-500 lines): 6-8 questions
  - Very large diff (500+ lines): 8-10 questions

- **Question Types** (mix these):
  - "Why" questions: Purpose behind a change
  - "How" questions: Mechanism of implementation
  - "What if" questions: Edge cases and error handling
  - "Impact" questions: Effects on other parts of the codebase

- **Answer Format**:
  - Exactly 4 options (A, B, C, D)
  - One correct answer
  - Three plausible distractors that test common misconceptions
  - Options should be similar in length and style

### Step 4: Interactive Quiz
Use the AskUserQuestion tool to present questions one at a time.

For each question:
- Display the question text
- Show all 4 options
- Include a "Skip all remaining questions" option

After each answer:
- If correct: Acknowledge and explain briefly why it's correct
- If incorrect: Explain the correct answer without being condescending
- If skipped: Move to Step 5 immediately

Track:
- Questions answered correctly
- Questions answered incorrectly
- Questions skipped

### Step 5: Store Vibe Debt (if applicable)
If any questions were skipped OR answered incorrectly:

1. Create the `VibeDebt/` directory in the project root if it doesn't exist
2. Generate filename: `<branch-name>_<YYYY-MM-DD>.json`
3. Write JSON file with this structure:

```json
{
  "branchName": "feature/my-branch",
  "date": "2024-01-15",
  "diffSummary": {
    "overview": "...",
    "filesChanged": [...],
    "linesAdded": 123,
    "linesRemoved": 45
  },
  "vibeDebt": [
    {
      "id": "q1",
      "question": "Why was X implemented this way?",
      "options": {
        "A": "...",
        "B": "...",
        "C": "...",
        "D": "..."
      },
      "correctAnswer": "B",
      "explanation": "...",
      "status": "skipped|incorrect",
      "userAnswer": null|"A",
      "relatedFiles": ["src/file.ts"],
      "category": "why|how|what-if|impact"
    }
  ],
  "stats": {
    "totalQuestions": 5,
    "correct": 2,
    "incorrect": 1,
    "skipped": 2
  }
}
```

### Step 6: Present Results
Display a summary:
- Total questions: X
- Correct answers: Y
- Incorrect answers: Z
- Skipped: W
- Vibe Debt score: (incorrect + skipped) / total * 100

If Vibe Debt was stored, inform the user of the file location.

Provide encouragement based on score:
- 0% debt: "Perfect understanding! You own this code."
- 1-25% debt: "Great job! Minor gaps to review later."
- 26-50% debt: "Good start. Consider reviewing the saved questions."
- 51-75% debt: "Significant vibe debt. Schedule time to review."
- 76-100% debt: "High vibe debt. Review before merging recommended."

## Configuration

The skill respects these environment variables or config:
- `DOI_MAIN_BRANCH`: Override the main branch name (default: auto-detect main/master)
- `DOI_MIN_QUESTIONS`: Minimum questions to generate (default: 2)
- `DOI_MAX_QUESTIONS`: Maximum questions to generate (default: 10)

## Privacy

- All data stays local
- Git commands run locally only
- No external API calls for analysis
- Vibe Debt files are stored in your project directory
