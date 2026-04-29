# AGENTS.md

Guidance for coding agents and contributors working in this repository.

## Project overview
- This repository is a Google Sheets SQL engine implemented in Google Apps Script.
- Primary source files are under `src/` and use `.gs` syntax.
- Parser files (`src/SQLParser.gs`, `src/SimpleSQL.gs`) are vendored/generated and should be edited only when absolutely necessary.

## Scope and priorities
1. Preserve SQL behavior and backward compatibility where possible.
2. Prefer safe spreadsheet operations (avoid destructive actions on arbitrary active sheets).
3. Keep Apps Script editor UX compatible with current best practices.
4. Keep setup/documentation accurate for `clasp` workflows.

## Coding guidelines
- Use V8-compatible JavaScript syntax supported by Apps Script.
- Prefer strict equality (`===`, `!==`) unless coercion is required.
- Keep functions small and single-purpose where practical.
- Avoid introducing external runtime dependencies.
- Do not wrap imports in try/catch blocks.

## UI and trigger guidance (Sheets add-on)
- Prefer `SpreadsheetApp.getUi()` dialogs/menus over legacy `Browser.*` APIs.
- Keep `onOpen(e)` menu wiring deterministic.
- If installation UX is needed, use `onInstall(e)` to call `onOpen(e)`.

## Spreadsheet safety and performance
- Use batched range writes (`setValues`) instead of many `appendRow` calls for large output.
- Avoid clearing/modifying the active sheet unless the intent is explicit.
- Prefer operating on the dedicated SQL output/history sheet (`SQL`).

## Manifest and scopes
- Keep `src/appsscript.json` in sync with runtime and scope needs.
- Prefer minimal OAuth scopes; do not broaden scopes without clear justification.

## Testing and validation
- Before committing, run at minimum:
  - `git diff --check`
  - `git status --short`
- If behavior changes are non-trivial, include manual verification steps in PR notes.

## Documentation
- Update `README.md` when setup, runtime expectations, or developer workflow changes.
- Keep guidance concise and actionable.
