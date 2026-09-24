# Project workspace

User designated this sandmosaic directory as the canonical editor and level workspace. Make future edits here, not in the historical 华容道+沙子项目/关卡编辑器 copy.

- Competitor levels: level/level-*.json (577 existing files). Preserve unless user explicitly requests competitor edits.
- Authored levels: our-level/level-*.json. New/copy/save must keep this directory.
- Display sequence is separate from globally unique file ID.
- Read docs/关卡生成验收标准.md before generating levels. Each finished layer counts as one elimination. Existing V2 win proofs do not prove the new opening-order or minimum-move requirements.
- Browser preview is read-only; native WebView persists only on Save.
- Respect existing uncommitted changes. Do not commit or push unless requested.

## Competitor 2 import

- competitor2-level/ contains 493 ColorSand 1.1.9 levels (470 mainline + 23 extras). Do not mix with original level/ or authored our-level/.
- competitor2-level/quarantine/ holds 4 invalid source resources and is intentionally not scanned.
- Per-level editorMeta.palette is authoritative for these levels and authored copies. Never map their IDs directly to the shared palette or drop this metadata on copy.
- competitor2-import.json maps source IDs to disk IDs. Do not infer IDs arithmetically; additional resources can be interspersed. Import script refuses repeated imports to prevent duplicates.
- Read docs/竞品2导入说明.md for compatibility limits; imported data does not establish original behavior or playthrough correctness.
