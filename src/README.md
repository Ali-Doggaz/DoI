# Source Code

This directory contains the implementation of Claude Code skills for RuleYourUsage.

## Structure

```
src/
└── doi/                    # /doi skill - Understand Your Vibe-Coded Changes
    ├── index.ts            # Main entry point and re-exports
    ├── types.ts            # TypeScript interfaces and types
    ├── git/                # Git diff extraction
    │   ├── index.ts
    │   └── extract.ts      # Git commands and diff parsing
    ├── analyzer/           # Diff understanding
    │   ├── index.ts
    │   └── summarize.ts    # Change categorization and summarization
    ├── questions/          # Question generation
    │   ├── index.ts
    │   └── generate.ts     # MCQ templates and generation logic
    ├── ui/                 # Interactive UI
    │   ├── index.ts
    │   └── interactive.ts  # Quiz presentation and feedback
    └── storage/            # Vibe Debt persistence
        ├── index.ts
        └── vibedebt.ts     # File storage for unanswered questions
```

## Skill: /doi

The `/doi` skill helps developers understand code they've "vibe-coded" on their current Git branch.

### Features

1. **Git Diff Extraction**: Compares current branch against main/master
2. **Change Analysis**: Categorizes and summarizes what changed
3. **Question Generation**: Creates MCQs testing code understanding
4. **Interactive Quiz**: Presents questions with immediate feedback
5. **Vibe Debt Storage**: Saves unanswered questions for later review

### Invocation

```
/doi
```

### How It Works

1. Detects your current branch and compares against main
2. Summarizes the changes at a high level
3. Generates comprehension questions scaled to diff size
4. Presents an interactive quiz via Claude Code's UI
5. Stores "vibe debt" (skipped/incorrect) to `VibeDebt/` folder

### Vibe Debt Storage

Unanswered or incorrect questions are saved to:
```
VibeDebt/<branch-name>_<YYYY-MM-DD>.json
```

This data is:
- Fully local (never uploaded)
- JSON formatted for easy parsing
- Designed for a future "resolve vibe debt" skill

## Development

### Type Checking

```bash
npm run typecheck
```

### Building

```bash
npm run build
```

The skill modules are designed to be used conceptually by Claude Code.
The TypeScript code provides:
- Type definitions for consistent data structures
- Utility functions for parsing and formatting
- Templates and guidelines for LLM-driven features
