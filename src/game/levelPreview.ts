import {
  GRASS_FIELD_SIZE,
  GRASS_LOGICAL_COLUMNS,
  isPointInArenaGrowth,
  type ArenaLayoutId,
} from "./world";

export const LEVEL_PREVIEW_COLUMNS = GRASS_LOGICAL_COLUMNS;

export function sampleArenaPreview(arenaId: ArenaLayoutId): boolean[] {
  const cells: boolean[] = [];
  const cellSize = GRASS_FIELD_SIZE / GRASS_LOGICAL_COLUMNS;
  const halfField = GRASS_FIELD_SIZE / 2;

  for (let row = 0; row < GRASS_LOGICAL_COLUMNS; row += 1) {
    for (let column = 0; column < GRASS_LOGICAL_COLUMNS; column += 1) {
      const x = -halfField + (column + 0.5) * cellSize;
      const z = -halfField + (row + 0.5) * cellSize;
      cells.push(isPointInArenaGrowth(arenaId, x, z));
    }
  }

  return cells;
}

export function createLevelPreview(arenaId: ArenaLayoutId, label: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("intro-card__contract-preview");
  svg.setAttribute("viewBox", `0 0 ${GRASS_LOGICAL_COLUMNS} ${GRASS_LOGICAL_COLUMNS}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("focusable", "false");

  const cells = sampleArenaPreview(arenaId);
  const occupied = cells.flatMap((visible, index) => (visible ? [index] : []));
  const columns = occupied.map((index) => index % GRASS_LOGICAL_COLUMNS);
  const rows = occupied.map((index) => Math.floor(index / GRASS_LOGICAL_COLUMNS));
  const width = Math.max(...columns) - Math.min(...columns) + 1;
  const height = Math.max(...rows) - Math.min(...rows) + 1;
  const coverage = Math.round((occupied.length / cells.length) * 100);
  svg.setAttribute(
    "aria-label",
    `${label} map preview, ${width} by ${height} cell footprint, ${coverage}% field coverage`,
  );
  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  background.setAttribute("class", "intro-card__contract-preview-bg");
  background.setAttribute("width", String(GRASS_LOGICAL_COLUMNS));
  background.setAttribute("height", String(GRASS_LOGICAL_COLUMNS));
  background.setAttribute("rx", "2.2");
  svg.append(background);

  cells.forEach((visible, index) => {
    if (!visible) {
      return;
    }
    const cell = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const column = index % GRASS_LOGICAL_COLUMNS;
    const row = Math.floor(index / GRASS_LOGICAL_COLUMNS);
    cell.setAttribute("class", "intro-card__contract-preview-cell");
    cell.setAttribute("x", String(column + 0.18));
    cell.setAttribute("y", String(row + 0.18));
    cell.setAttribute("width", "0.64");
    cell.setAttribute("height", "0.64");
    cell.setAttribute("rx", "0.18");
    svg.append(cell);
  });

  const hub = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  hub.setAttribute("class", "intro-card__contract-preview-hub");
  hub.setAttribute("cx", String(GRASS_LOGICAL_COLUMNS / 2));
  hub.setAttribute("cy", String(GRASS_LOGICAL_COLUMNS / 2));
  hub.setAttribute("r", "0.78");
  svg.append(hub);

  return svg;
}
