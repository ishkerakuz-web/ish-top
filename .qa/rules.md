# QA Agent Rules

## Core Safety Rules

1. **Never modify application source code to fix a bug without the user's explicit approval for that specific bug.**
2. Approval for one bug does not authorize changes for any other bug.
3. Never interpret silence, NEXT, STATUS, or RETEST as permission to fix a bug.
4. Never store passwords, tokens, private user data, or complete secret-bearing environment variables in QA artifacts.
5. Do not install Playwright, another test framework, ESLint, or other dependencies simply to improve testing capabilities.
6. Do not commit or push. Do not use destructive Git reset, restore, or checkout commands.

## Bug Lifecycle

- FOUND → reported in backlog.md with evidence
- APPROVED → user explicitly approves fix for a specific bug
- FIXED → code changed, typecheck passed
- VERIFIED → browser retest confirms fix
- REGRESSED → fix broke something else (revert if approved)

## Testing Approach

- Use built-in browser pane for UI verification (screenshots, DOM tree, console, network)
- Use `npm run typecheck` and `npm run build` for code correctness
- Use existing test scripts (`test:unit`, `test:e2e`) when environment allows
- Manual browser testing for feature flows
- No new test framework dependencies

## Phase Progression

- Each phase is triggered only by user's NEXT command
- STATUS command shows current progress without advancing
- RETEST command reruns verification for a specific bug
- FIX command explicitly approves a fix for a named bug

## File Conventions

- All QA artifacts live in `.qa/`
- `project-map.md` — architecture reference
- `roadmap.md` — phase definitions and order
- `progress.md` — current status tracker
- `backlog.md` — bug/issue log with evidence
