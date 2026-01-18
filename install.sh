#!/bin/bash

# /doi skill installer for Claude Code
# Usage: ./install.sh [--global | target-directory]
# --global: Install to ~/.claude/skills/doi (available in all projects)
# target-directory: Install to that project's .claude/skills/doi
# No args: Install globally

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default to global install
if [ "$1" = "--global" ] || [ -z "$1" ]; then
    TARGET_SKILL_DIR="$HOME/.claude/skills/doi"
else
    TARGET_SKILL_DIR="$1/.claude/skills/doi"
fi

echo -e "${YELLOW}Installing /doi skill for Claude Code...${NC}"

# Check source files exist
if [ ! -f "$SCRIPT_DIR/.claude/skills/doi/SKILL.md" ]; then
    echo -e "${RED}Error: SKILL.md not found${NC}"
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/src/doi" ]; then
    echo -e "${RED}Error: src/doi not found${NC}"
    exit 1
fi

# Create target directory
mkdir -p "$TARGET_SKILL_DIR/src"

# Copy SKILL.md
cp "$SCRIPT_DIR/.claude/skills/doi/SKILL.md" "$TARGET_SKILL_DIR/SKILL.md"

# Copy src/doi contents
cp -r "$SCRIPT_DIR/src/doi/"* "$TARGET_SKILL_DIR/src/"

echo -e "${GREEN}Installed /doi skill to $TARGET_SKILL_DIR${NC}"
echo ""
echo "You can now use /doi in Claude Code!"
