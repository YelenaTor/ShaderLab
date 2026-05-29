import type { InitExample, UiFramework } from "./writers/types.js";

export function defaultExample(ui: UiFramework): InitExample {
  return ui === "unknown" ? "vanilla" : ui;
}

export function parseYesNoAnswer(answer: string, defaultValue: boolean): boolean {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return defaultValue;
  return normalized === "y" || normalized === "yes";
}

export function parseExampleAnswer(answer: string, ui: UiFramework): {
  example: InitExample;
  message?: string;
} {
  const fallback = defaultExample(ui);
  const choice = answer.trim().toLowerCase() || fallback;
  if (
    choice === "react" ||
    choice === "vue" ||
    choice === "svelte" ||
    choice === "vanilla" ||
    choice === "none"
  ) {
    return { example: choice };
  }
  return {
    example: fallback,
    message: `Unknown example choice "${choice}", using ${fallback}.`,
  };
}
