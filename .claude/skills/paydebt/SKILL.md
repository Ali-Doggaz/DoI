---
name: paydebt
description: Pay off your vibe debt by answering questions from previous /doi sessions
---

# /paydebt - Pay Off Your Vibe Debt

Review and answer questions you previously skipped, got wrong, or revealed during `/doi` sessions.

## When to Use
Invoke this skill with `/paydebt` when you want to:
- Review questions you didn't answer correctly in past `/doi` sessions
- Reduce your accumulated vibe debt
- Solidify your understanding of code you vibe-coded

## Behavior

When invoked, this skill will:

1. **Scan VibeDebt Folder** - Find all vibe debt JSON files
2. **Present Questions** - Ask questions from each file one at a time
3. **Track Progress** - Remove correctly answered questions from files
4. **Allow Control** - User can continue to next file or stop at any time
5. **Clean Up** - Delete files when all questions are answered
6. **Summarize** - Show progress summary when stopping

## Instructions

Execute the following steps in order:

### Step 1: Scan for Vibe Debt Files

Use the Bash tool to list all JSON files in the VibeDebt directory:

```bash
ls -la ./VibeDebt/*.json 2>/dev/null || echo "NO_FILES"
```

**If no files exist:**
- Display: "No vibe debt found! You're all caught up."
- Exit gracefully

**If files exist:**
- Count total files and total questions across all files
- Display initial summary:
  ```
  Found X vibe debt file(s) with Y total question(s):

  1. branch-name_2024-01-15.json (3 questions)
  2. other-branch_2024-01-14.json (5 questions)
  ...
  ```

### Step 2: Process Files Sequentially

For each vibe debt file, in order:

1. **Read the file** using the Read tool
2. **Parse the JSON** to extract the `vibeDebt` array and metadata
3. **Display file context:**
   ```
   --- File 1/X: branch-name_2024-01-15.json ---
   Branch: feature/my-branch
   Original date: 2024-01-15
   Questions remaining: N

   Context: [diffSummary.overview from the file]
   ```

4. **Ask questions from this file** following Step 3

### Step 3: Interactive Question Loop

For each question in the current file's `vibeDebt` array:

**Question Format:**
Use AskUserQuestion with this format:

```json
{
  "questions": [{
    "question": "Question N/M (from branch-name):\n\n<question text>\n\n_Type \"next file\" to skip to next file, or \"stop\" to end session_",
    "header": "QN",
    "multiSelect": false,
    "options": [
      { "label": "A", "description": "<option A from file>" },
      { "label": "B", "description": "<option B from file>" },
      { "label": "C", "description": "<option C from file>" },
      { "label": "D", "description": "<option D from file>" }
    ]
  }]
}
```

**Response Handling:**

**If user selects the correct answer (matches `correctAnswer` field):**
- Display: `Correct! <explanation from file>`
- **Mark this question as resolved** (to be removed from the file)
- Track: increment `questionsAnswered` counter
- Continue to next question

**If user selects a wrong answer:**
- Display: `Incorrect. The correct answer is **<correctAnswer>**: "<answer text>"`
- Display the explanation from the file
- **Keep this question in the file** (it remains vibe debt)
- Track: increment `questionsRemaining` counter
- Ask follow-up: "Would you like to continue with this file?"
  - **Continue**: Move to next question
  - **Next File**: Skip to Step 4 (next file)
  - **Stop**: Skip to Step 5 (summary)

**If Other contains "next file" (case-insensitive):**
- Display: `Skipping to next file...`
- Proceed to Step 4 with remaining questions kept in file

**If Other contains "stop" (case-insensitive):**
- Display: `Ending session...`
- Proceed to Step 5 immediately

**If Other (anything else):**
- Treat as a clarification question
- Answer the user's question about the code/topic
- Re-present the same quiz question

### Step 4: Update Vibe Debt File

After processing questions from a file (whether all answered or user moved on):

**If ALL questions were answered correctly:**
- Delete the file using Bash: `rm "./VibeDebt/<filename>"`
- Display: `All questions answered! Deleted <filename>`

**If SOME questions remain (wrong answers or skipped):**
- Update the file with only the remaining questions
- Use Write tool to save the updated JSON:

```json
{
  "branchName": "<original branchName>",
  "date": "<original date>",
  "diffSummary": { ... },
  "vibeDebt": [
    // Only questions that were NOT answered correctly
  ],
  "stats": {
    "totalQuestions": <new count>,
    "correct": 0,
    "incorrect": <count>,
    "revealed": <count>,
    "skipped": <count>
  },
  "schemaVersion": 1
}
```

- Display: `Updated <filename>: N questions remaining`

**Then:**
- If more files exist and user hasn't stopped, proceed to next file (Step 2)
- If no more files or user stopped, proceed to Step 5

### Step 5: Present Summary

Display a session summary with clear statistics:

```
=== Vibe Debt Session Complete ===

This Session:
- Questions answered correctly: X
- Questions still remaining: Y
- Files cleared: Z
- Files updated: W

Remaining Vibe Debt:
- Total files: N
- Total questions: M

[Encouragement message based on progress]
```

**Encouragement messages:**
- 100% cleared: "Amazing! All vibe debt paid off. You truly understand your code!"
- 75%+ cleared: "Great progress! You're almost debt-free."
- 50%+ cleared: "Good work! You've made a solid dent in your vibe debt."
- 25%+ cleared: "Nice start! Keep chipping away at it."
- <25% cleared: "Every question counts. Come back soon to continue!"
- 0 answered: "No worries - your vibe debt will be here when you're ready."

**If no vibe debt remains:**
- Display: "Your vibe debt is fully paid! Run `/doi` on your next branch to keep learning."

## File Format Reference

Vibe debt files have this structure:
```json
{
  "branchName": "feature/my-branch",
  "date": "2024-01-15",
  "diffSummary": {
    "overview": "Description of changes...",
    "filesChanged": ["file1.ts", "file2.ts"],
    "linesAdded": 100,
    "linesRemoved": 20
  },
  "vibeDebt": [
    {
      "id": "q1",
      "question": "Why was X implemented?",
      "options": {
        "A": "Option A text",
        "B": "Option B text",
        "C": "Option C text",
        "D": "Option D text"
      },
      "correctAnswer": "B",
      "explanation": "Because...",
      "status": "skipped|incorrect|revealed",
      "userAnswer": null,
      "relatedFiles": ["src/file.ts"],
      "category": "why|how|what-if|impact"
    }
  ],
  "stats": { ... },
  "schemaVersion": 1
}
```

## Privacy

- All data stays local
- No external API calls
- Files are stored in your project's VibeDebt/ directory
