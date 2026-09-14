import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/open-retirement-toolkit/" : "/",
  test: {
    coverage: {
      provider: "v8",
      include: ["src/domain.ts", "src/scenario-schema.ts", "src/analysis.ts", "src/report.ts", "src/engine/**/*.ts"],
      thresholds: { statements: 85, branches: 75, functions: 85, lines: 85 }
    }
  }
}));
