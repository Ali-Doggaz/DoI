# RuleYourUsage Architecture

This document describes the architecture and main modules of the RuleYourUsage Claude Code plugin.

## Overview

RuleYourUsage is a Claude Code skill plugin that helps developers reduce "vibe debt" by testing their understanding of code changes made on their current Git branch. When invoked via `/doi`, it generates a comprehension quiz based on the branch's diff.

## Project Structure

```
src/
└── doi/                      # Main skill implementation
    ├── index.ts              # Entry point and exports
    ├── types.ts              # Shared type definitions
    ├── git/
    │   └── extract.ts        # Git diff extraction
    ├── analyzer/
    │   └── summarize.ts      # Diff analysis and categorization
    ├── questions/
    │   └── generate.ts       # Question generation framework
    ├── ui/
    │   └── interactive.ts    # Quiz interaction patterns
    └── storage/
        └── vibedebt.ts       # Vibe debt persistence

.claude/
└── skills/doi/
    └── SKILL.md              # Claude Code skill definition
```

## Main Modules

### 1. Types (`src/doi/types.ts`)

Central type definitions ensuring consistent data flow across the plugin:

| Type Category | Key Types | Purpose |
|---------------|-----------|---------|
| Git Context | `GitContext`, `GitDiff`, `ChangedFile` | Structured git data |
| Analysis | `ChangeCategory`, `DiffSummary` | Categorized change info |
| Questions | `MCQuestion`, `QuestionSet` | Quiz question structures |
| Quiz Session | `QuizSession`, `QuizStats` | Session tracking |
| Vibe Debt | `VibeDebtRecord` | Persistent storage format |

**Change Categories:** `new-feature`, `modified-logic`, `refactoring`, `deletion`, `configuration`, `documentation`, `testing`

**Question Categories:** `why`, `how`, `what-if`, `impact`

---

### 2. Git Extraction (`src/doi/git/extract.ts`)

Handles all Git interactions and diff parsing.

**Key Functions:**

- `GIT_COMMANDS` - Exported git command templates for:
  - Default branch detection (remote HEAD → upstream → closest ancestor)
  - Merge base calculation
  - Diff extraction with stats
  - Commit log parsing

- `parseNumstat()` - Parses `git diff --numstat` into file change data
- `parseNameStatus()` - Parses `git diff --name-status` for change types
- `calculateComplexity()` - Scores diff complexity (0-100)
- `calculateQuestionCount()` - Scales questions based on diff size (2-10)
- `validateContext()` - Validates repository state for analysis

---

### 3. Diff Analyzer (`src/doi/analyzer/summarize.ts`)

Transforms raw git data into structured analysis.

**Key Functions:**

- `categorizeChanges()` - Groups files into 7 categories using:
  - Path patterns (config files, tests, docs)
  - Change types (added → new-feature, deleted → deletion)

- `identifyKeyFiles()` - Ranks files by importance (prioritizes source code, new files)
- `inferIntent()` - Infers branch purpose from:
  - Branch name patterns (`feat/`, `fix/`, `refactor/`)
  - Commit messages

- `generateDiffSummary()` - Main entry combining all analysis into `DiffSummary`

---

### 4. Question Generation (`src/doi/questions/generate.ts`)

Provides templates and guidelines for MCQ generation (actual generation performed by Claude during execution).

**Question Distribution:**
| Category | Weight | Focus |
|----------|--------|-------|
| Why | 25% | Purpose and motivation |
| How | 35% | Implementation details |
| What-if | 20% | Edge cases, error handling |
| Impact | 20% | Effects on codebase |

**Key Exports:**
- `QUESTION_TEMPLATES` - Template patterns per category
- `DISTRACTOR_GUIDELINES` - Creating plausible wrong answers
- `QUESTION_GENERATION_GUIDELINES` - Quality standards for Claude
- `distributeQuestionCategories()` - Determines question mix
- `calculateComplexityScore()` - Weighted scoring for diff complexity

---

### 5. Interactive UI (`src/doi/ui/interactive.ts`)

Defines interaction patterns for Claude Code's UI tools.

**Key Functions:**
- `formatQuestionForPresentation()` - Formats MCQ for `AskUserQuestion` tool
- `generateFeedback()` - Creates response text with emoji indicators (✅/❌/💡)
- `generateEnhancedFeedback()` - Enhanced feedback with optional code snippets
- `generateProgressDisplay()` - Shows quiz progress bar
- `generateResultsSummary()` - Final results with vibe debt percentage
- `updateStats()` - Updates statistics after each answer (supports `revealed` status)
- `createPostIncorrectPrompt()` - Creates continue/ask-more prompt after wrong answers

**Options:** Each question includes A/B/C/D answer choices. "Show Me" and "Skip" are accessed via the "Other" option where users type the command (AskUserQuestion only supports 2-4 options, so we use all 4 for answers).

---

### 6. Vibe Debt Storage (`src/doi/storage/vibedebt.ts`)

Manages local persistence of unanswered/incorrect questions.

**Storage Location:** `VibeDebt/<branch-name>_<YYYY-MM-DD>.json`

**Key Functions:**
- `generateFilename()` - Sanitizes branch names for filesystem
- `createVibeDebtRecord()` - Converts quiz results to storage format
- `serializeRecord()` / `parseRecord()` - JSON handling
- `STORAGE_COMMANDS` - Bash command templates for file operations

**Schema:** Versioned (`schemaVersion: 1`) for future compatibility.

---

## Execution Flow

```
/doi invoked
    │
    ▼
┌─────────────────┐
│ Git Extraction  │ ─── Detect branch, compute merge base, extract diff
└────────┬────────┘
         ▼
┌─────────────────┐
│ Diff Analysis   │ ─── Categorize changes, identify key files, infer intent
└────────┬────────┘
         ▼
┌─────────────────┐
│ Question Gen    │ ─── Determine count, distribute categories, generate MCQs
└────────┬────────┘
         ▼
┌─────────────────┐
│ Interactive Quiz│ ─── Present questions, collect answers, provide feedback
└────────┬────────┘
         ▼
┌─────────────────┐
│ Store Vibe Debt │ ─── Save skipped/incorrect questions locally
└────────┬────────┘
         ▼
┌─────────────────┐
│ Show Results    │ ─── Display stats, vibe debt %, encouragement
└─────────────────┘
```

## Design Principles

1. **Local-First** - All data stays in the project directory; no cloud uploads
2. **Zero Dependencies** - Only `typescript` as dev dependency
3. **Comprehension-Focused** - Tests understanding of *why*, not just *what*
4. **Scalable Complexity** - Question count adapts to diff size
5. **Modular Architecture** - Each module has a single responsibility
