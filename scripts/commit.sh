#!/usr/bin/env bash
# =============================================================================
#  scripts/commit.sh
#  Lint gate + test runner + git commit helper
#
#  Usage:
#    ./scripts/commit.sh "feat: your commit message"
#
#  What it does:
#    1. Checks that a commit message was provided
#    2. Runs ruff linter (error = hard stop)
#    3. Runs ruff formatter check (error = hard stop)
#    4. Runs pytest when tests exist
#    5. If all pass → stages all changes and commits
#
#  This script will grow throughout development.
#  Add new checks below the clearly marked section.
# =============================================================================

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass() { echo -e "${GREEN}✔ $1${RESET}"; }
fail() { echo -e "${RED}✘ $1${RESET}"; exit 1; }
info() { echo -e "${CYAN}→ $1${RESET}"; }
header() { echo -e "\n${BOLD}${YELLOW}$1${RESET}"; }

# ─── Argument Check ──────────────────────────────────────────────────────────
if [ -z "${1:-}" ]; then
  echo -e "${RED}Error: commit message required.${RESET}"
  echo -e "Usage: ${BOLD}./scripts/commit.sh \"your commit message\"${RESET}"
  exit 1
fi

COMMIT_MSG="$1"

header "═══ flappy-rl commit gate ════════════════════════════════"

PYTHON_TARGETS=(src)
if [ -d "tests" ]; then
  PYTHON_TARGETS+=(tests)
fi

# ─── Step 1: Ruff Lint ───────────────────────────────────────────────────────
header "Step 1 / Ruff lint"
info "Running: uv run ruff check ${PYTHON_TARGETS[*]}"
if uv run ruff check "${PYTHON_TARGETS[@]}"; then
  pass "Lint clean"
else
  fail "Lint failed — fix errors before committing"
fi

# ─── Step 2: Ruff Format Check ───────────────────────────────────────────────
header "Step 2 / Ruff format check"
info "Running: uv run ruff format --check ${PYTHON_TARGETS[*]}"
if uv run ruff format --check "${PYTHON_TARGETS[@]}"; then
  pass "Format clean"
else
  echo -e "${YELLOW}Auto-formatting now...${RESET}"
  uv run ruff format "${PYTHON_TARGETS[@]}"
  pass "Format applied — files updated"
fi

# ─── Step 3: Pytest ──────────────────────────────────────────────────────────
header "Step 3 / Tests"
if [ -d "tests" ]; then
  info "Running: uv run pytest tests/ -v --tb=short"
  if uv run pytest tests/ -v --tb=short; then
    pass "All tests passed"
  else
    fail "Tests failed — fix before committing"
  fi
else
  info "Skipping pytest because tests/ does not exist yet"
  pass "No tests directory yet"
fi

# =============================================================================
#  ADD NEW CHECKS BELOW THIS LINE AS THE PROJECT GROWS
#  Examples:
#    - Type checking:  mypy src/
#    - Security scan:  bandit -r src/
#    - Dead code:      vulture src/
#    - Dependency audit: uv pip check
# =============================================================================

# ─── Commit ──────────────────────────────────────────────────────────────────
header "All gates passed — committing"
info "git add -A"
git add -A

info "git commit -m \"${COMMIT_MSG}\""
git commit -m "${COMMIT_MSG}"

echo ""
echo -e "${GREEN}${BOLD}✔ Committed: ${COMMIT_MSG}${RESET}"
echo ""
