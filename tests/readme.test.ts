import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { CONTRACT_DEFINITIONS } from "../src/game/state";
import { createMeadowLayout } from "../src/game/world";

declare const process: { cwd: () => string };

describe("contract documentation", () => {
  it("documents every authored contract title and debug URL selector in the README", async () => {
    const readme = new TextDecoder().decode(await readFile(`${process.cwd()}/README.md`));

    for (const contract of CONTRACT_DEFINITIONS) {
      expect(readme).toContain(contract.title);
      expect(readme).toContain(`?contract=${contract.id}`);
    }
  });

  it("keeps PRD authored contract sections aligned with the contract registry", async () => {
    const prd = new TextDecoder().decode(await readFile(`${process.cwd()}/PRD.md`));

    for (const contract of CONTRACT_DEFINITIONS) {
      expect(prd).toContain(`### ${contract.title}`);
      expect(prd).toContain(`Contract ID: \`${contract.id}\``);
    }
  });

  it("keeps README arena-edge marker range aligned with authored layouts", async () => {
    const readme = new TextDecoder().decode(await readFile(`${process.cwd()}/README.md`));
    const markerCounts = CONTRACT_DEFINITIONS.map(
      (contract) => createMeadowLayout(12345, contract.id).boundaryMarkers.length,
    );
    const minMarkers = Math.min(...markerCounts);
    const maxMarkers = Math.max(...markerCounts);

    expect(readme).toContain(`${minMarkers}-${maxMarkers} low-profile arena-edge marker instances`);
  });

  it("does not retain superseded shipped-feature planning copy", async () => {
    const readme = new TextDecoder().decode(await readFile(`${process.cwd()}/README.md`));
    const prd = new TextDecoder().decode(await readFile(`${process.cwd()}/PRD.md`));

    expect(readme).not.toContain("Phase 4 presentation/accessibility work has started");
    expect(readme).toContain(
      "Phase 4 presentation/accessibility systems are implemented and verified",
    );
    expect(prd).not.toContain("mobile support is a later phase");
    expect(prd).not.toContain(
      "Select generation/licensing pipeline and reduced-sensory defaults later",
    );
    expect(prd).toContain("browser phone/touch playability");
    expect(prd).toContain("Procedural WebAudio ships");
  });
});
