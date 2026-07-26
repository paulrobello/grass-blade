import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { CONTRACT_DEFINITIONS } from "../src/game/state";

declare const process: { cwd: () => string };

describe("README contract documentation", () => {
  it("documents every authored contract title and debug URL selector", async () => {
    const readme = new TextDecoder().decode(await readFile(`${process.cwd()}/README.md`));

    for (const contract of CONTRACT_DEFINITIONS) {
      expect(readme).toContain(contract.title);
      expect(readme).toContain(`?contract=${contract.id}`);
    }
  });
});
