import { minesFromCells, revealAllExcept } from "./boardUtils";

/*
  One hidden safe target per board, everything else revealed.

  "line":   mine / target / mine in a row or column (a 1-2-1 with the click in the middle).
  "corner": target in a board corner with a single mine next to it along the edge.

  Both layouts guarantee every revealed neighbour of the target is a number,
  so the only way to open the target is to click it.

  params.pattern: "mixed" | "line" | "corner"
*/

function lineLayouts(width, height) {
  const layouts = [];

  //Need a perpendicular row so the 1-2-1 numbers exist
  if (width >= 3 && height >= 2) {
    for (let x = 1; x <= width - 2; x++) {
      for (let y = 0; y < height; y++) {
        layouts.push({
          target: { x, y },
          mines: [
            { x: x - 1, y },
            { x: x + 1, y },
          ],
          orientation: "horizontal",
        });
      }
    }
  }

  if (height >= 3 && width >= 2) {
    for (let x = 0; x < width; x++) {
      for (let y = 1; y <= height - 2; y++) {
        layouts.push({
          target: { x, y },
          mines: [
            { x, y: y - 1 },
            { x, y: y + 1 },
          ],
          orientation: "vertical",
        });
      }
    }
  }

  return layouts;
}

function cornerLayouts(width, height) {
  const layouts = [];
  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];

  for (const corner of corners) {
    const inwardX = corner.x === 0 ? 1 : -1;
    const inwardY = corner.y === 0 ? 1 : -1;

    //A number beyond the mine (third column/row) is what proves the mine
    if (width >= 3 && height >= 2) {
      layouts.push({
        target: corner,
        mines: [{ x: corner.x + inwardX, y: corner.y }],
        orientation: "horizontal",
      });
    }
    if (height >= 3 && width >= 2) {
      layouts.push({
        target: corner,
        mines: [{ x: corner.x, y: corner.y + inwardY }],
        orientation: "vertical",
      });
    }
  }

  return layouts;
}

export default function singleTarget({ width, height, params, rng }) {
  const pattern = params.pattern ?? "mixed";

  const layoutsByPattern = {
    line: lineLayouts(width, height),
    corner: cornerLayouts(width, height),
  };

  let patternName;
  if (pattern === "mixed") {
    const available = Object.keys(layoutsByPattern).filter(
      (name) => layoutsByPattern[name].length > 0
    );
    if (available.length === 0) {
      throw new Error("Board is too small for this practice scenario");
    }
    patternName = rng.pick(available);
  } else if (layoutsByPattern[pattern]) {
    patternName = pattern;
  } else {
    throw new Error(`Unknown single-target pattern "${pattern}"`);
  }

  const layouts = layoutsByPattern[patternName];
  if (layouts.length === 0) {
    throw new Error("Board is too small for this practice scenario");
  }

  const layout = rng.pick(layouts);
  const mines = minesFromCells(width, height, layout.mines);

  return {
    mines,
    initialTiles: revealAllExcept(mines, [layout.target]),
    targets: [{ x: layout.target.x, y: layout.target.y, kind: "click" }],
    meta: { pattern: patternName, orientation: layout.orientation },
  };
}
