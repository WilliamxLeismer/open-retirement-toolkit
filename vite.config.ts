import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/open-retirement-toolkit/" : "/",
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/analysis.ts", "src/backup.ts", "src/domain.ts", "src/recovery.ts",
        "src/report.ts", "src/scenario-schema.ts", "src/storage.ts", "src/engine/**/*.ts"
      ],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 }
    }
  }
}));
