# Repository context

For backend or admin work, read [BACKEND_CONTEXT.md](BACKEND_CONTEXT.md) first.
It records the backend review requested by the owner on 25 October 2026 and
links to the endpoint inventory and source map under `BackEnd/docs/`.

Use those notes to locate the relevant code, then read the affected files and
check changes since the recorded snapshot. Update the notes when backend
behavior changes. The notes describe a source review, not verified live state.

Preserve unrelated working-tree changes. Do not copy secrets from environment
files or credential files into documentation. Starting the backend or running
operational scripts can touch configured external services; use offline checks
for documentation-only work.
