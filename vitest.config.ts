import { configDefaults, defineConfig } from 'vitest/config';

// Vitest no debe leer `.claude/` (ahí viven los worktrees): duplicaría la suite.
// Se conservan los valores por defecto, que ya incluyen `scripts/*.test.mjs`.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '**/.claude/**'] },
});
