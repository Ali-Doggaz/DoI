---
name: doi
description: Understand your vibe-coded changes by taking a comprehension quiz on your branch's diff
---

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
   - Detect the default branch from remote (e.g., `main`, `master`, `develop`)
   - Compute the git diff between default branch and current branch

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

# Get the base branch (the branch the current branch was built on top of)
# Priority: 1) Remote's default branch, 2) Upstream tracking branch, 3) Closest ancestor branch
CURRENT=$(git rev-parse --abbrev-ref HEAD)
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || \
git config --get branch.$CURRENT.merge 2>/dev/null | sed 's@^refs/heads/@@' || \
(for b in $(git branch -r | grep -v HEAD | grep -v "origin/$CURRENT" | sed 's/^ *//'); do \
  git merge-base HEAD "$b" >/dev/null 2>&1 && \
  echo "$(git rev-list --count $(git merge-base HEAD "$b")..HEAD) ${b#origin/}"; \
done | sort -n | head -1 | awk '{print $2}')

# Get the merge base (common ancestor)
git merge-base <default-branch> HEAD

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

### Step 3: Generate ALL Questions with Pre-Rendered Responses

**CRITICAL FOR SPEED:** Generate a complete question bank WITH pre-rendered feedback strings BEFORE starting the quiz.

For each question, prepare AND STORE as a structured block:
```
=== QUESTION 1 ===
QUESTION_TEXT: <the question>
OPTION_A: <option A>
OPTION_B: <option B>
OPTION_C: <option C>
OPTION_D: <option D>
CORRECT: <A|B|C|D>
FEEDBACK_CORRECT: ✅ **Correct!** <full explanation with code snippet if applicable>
FEEDBACK_WRONG: ❌ **Incorrect.** The correct answer is **<X>**: "<answer text>"

<full explanation with code snippet if applicable>
FEEDBACK_REVEALED: 💡 **Answer: <X>** - "<answer text>"

<full explanation with code snippet if applicable>
=== END QUESTION 1 ===
```

**Output this entire question bank** before proceeding to Step 4. This ensures:
- Zero generation time when showing feedback (just echo the pre-rendered string)
- Zero generation time for next question (just echo from the bank)

The only processing needed per answer is matching user input to CORRECT and selecting the right FEEDBACK_* string.

**Question Count** (scales with complexity):
- Small diff (1-50 lines): 2-3 questions
- Medium diff (50-200 lines): 4-6 questions
- Large diff (200-500 lines): 6-8 questions
- Very large diff (500+ lines): 8-10 questions

**Question Types** (mix these):
- "Why" questions (25%): Purpose behind a change
- "How" questions (35%): Mechanism of implementation
- "What if" questions (20%): Edge cases and error handling
- "Impact" questions (20%): Effects on other parts of the codebase

**Answer Format**:
- Exactly 4 options (A, B, C, D)
- One correct answer
- Three plausible distractors that test common misconceptions
- Options should be similar in length and style

**Code Snippet Format** (when applicable):
```json
{
  "codeSnippet": {
    "code": "function example() { ... }",
    "language": "typescript",
    "description": "This shows how the validation works"
  }
}
```

### Step 4: Interactive Quiz

Present questions one at a time using AskUserQuestion tool. Since all questions are pre-generated, there should be no delay between questions.

**Question Format:**
- Display question text with number (e.g., "Question 3/7:")
- Show 4 answer options: **A**, **B**, **C**, **D**
- Include hint for "show me" and "skip" via Other option

**IMPORTANT:** AskUserQuestion only supports 2-4 options. We use all 4 for answer choices. "Show Me" and "Skip" are accessed via the system-provided "Other" option where users type the command.

```json
{
  "questions": [{
    "question": "Question N/M: <question text>\n\n_💡 Type \"show me\" or \"skip\" in Other for special actions_",
    "header": "QN",
    "multiSelect": false,
    "options": [
      { "label": "A", "description": "<option A text>" },
      { "label": "B", "description": "<option B text>" },
      { "label": "C", "description": "<option C text>" },
      { "label": "D", "description": "<option D text>" }
    ]
  }]
}
```

**After user responds - USE PRE-RENDERED FEEDBACK (do not regenerate):**

**If A/B/C/D (correct answer):**
- **Echo FEEDBACK_CORRECT exactly as pre-rendered** (do not regenerate)
- Immediately show next question from bank

**If A/B/C/D (wrong answer):**
- **Echo FEEDBACK_WRONG exactly as pre-rendered** (do not regenerate)
- Then ask using AskUserQuestion: "Would you like to continue or learn more about this?"
  - **Continue**: Move to next question
  - **Ask More**: Let user ask follow-up questions about this topic, then continue when ready

**If Other contains "show" (case-insensitive):**
- **Echo FEEDBACK_REVEALED exactly as pre-rendered** (do not regenerate)
- This counts as vibe debt (tracked as "revealed" status)
- Proceed to next question

**If Other contains "skip" (case-insensitive):**
- Display: `⏭️ Skipped N remaining questions. These will be saved as Vibe Debt.`
- Mark all remaining questions as skipped
- Proceed immediately to Step 5

**If Other (anything else):**
- Treat as a clarification request about the current question
- Answer the user's question, then re-present the same quiz question

**Track:**
- Questions answered correctly
- Questions answered incorrectly
- Questions revealed (via "Show Me")
- Questions skipped

### Step 5: Store Vibe Debt (if applicable)

Save questions that were:
- Answered incorrectly
- Revealed via "Show Me"
- Skipped

If any of the above occurred:

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
      "status": "skipped|incorrect|revealed",
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
  },
  "schemaVersion": 1
}
```

**Status field values:**
- `"incorrect"` - User answered wrong
- `"revealed"` - User chose "Show Me"
- `"skipped"` - User chose "Skip All" or question was skipped

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
- `DOI_DEFAULT_BRANCH`: Override the default branch name (default: auto-detect from `origin/HEAD`, falls back to `main` or `master`)
- `DOI_MIN_QUESTIONS`: Minimum questions to generate (default: 2)
- `DOI_MAX_QUESTIONS`: Maximum questions to generate (default: 10)

## Privacy

- All data stays local
- Git commands run locally only
- No external API calls for analysis
- Vibe Debt files are stored in your project directory
