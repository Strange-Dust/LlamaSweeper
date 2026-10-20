import { minesFromCells, revealAllExcept } from "./boardUtils";

/*
  A whole row or column of hidden safe squares (the "line"), with everything else revealed.
  The rows (or columns) directly beside the line hold the mines. When there is one on both sides they are
  exact mirror images of each other, so every line square shows the same kind of number.

  A line at the edge of the board only has a mine row on its one inner side.

  Mine pattern along the line, which keeps the numbers trivial to read:
    - never three mines in a row
    - never three clear squares in a row
  A line square touches up to three neighbouring squares of the mine row, so together these mean it always has
  a mine nearby (so it is never a 0, which would open its neighbours when clicked) and always has a clear,
  revealed neighbour, whose number is what proves the line square is safe.
  The squares at the two ends only touch two squares of the mine row, so the same applies to that pair:
  exactly one of them is a mine. Without this the first or last line square could have nothing revealed beside it.

  A line also needs a revealed row on the far side of a mine row, which is what pins down where that row's mines
  are, so a line in the middle of a board only 3 squares across is not used.

  params.direction: "horizontal" | "vertical" | "mixed" (random per round)
*/

//Every group of squares a line square touches (3 along the line, 2 at either end) must hold a mine and a clear square
export function isValidMinePattern(pattern) {
  for (let i = 0; i < pattern.length; i++) {
    const nearby = pattern.slice(Math.max(0, i - 1), i + 2);
    if (!nearby.some(Boolean) || nearby.every(Boolean)) {
      return false;
    }
  }
  return true;
}

function createMinePattern(length, rng) {
  //Runs of three are avoided as the pattern is built, so only the ends can make it fail
  for (let attempt = 0; attempt < 500; attempt++) {
    const pattern = [];
    for (let i = 0; i < length; i++) {
      let isMine = rng.next() < 0.5;
      if (i >= 2 && pattern[i - 1] === isMine && pattern[i - 2] === isMine) {
        isMine = !isMine;
      }
      pattern.push(isMine);
    }
    if (isValidMinePattern(pattern)) {
      return pattern;
    }
  }
  throw new Error("Could not generate a mine pattern for the line");
}

export default function line({ width, height, params, rng }) {
  const direction = params.direction ?? "mixed";

  let orientation;
  if (direction === "horizontal" || direction === "vertical") {
    orientation = direction;
  } else if (direction === "mixed") {
    orientation = rng.pick(["horizontal", "vertical"]);
  } else {
    throw new Error(`Unknown line direction "${direction}"`);
  }

  const isHorizontal = orientation === "horizontal";
  const length = isHorizontal ? width : height; //Squares along the line
  const crossSize = isHorizontal ? height : width; //Rows (or columns) the line can sit in

  if (length < 3 || crossSize < 3) {
    throw new Error("Board is too small for this practice scenario");
  }

  //Needs a revealed row beyond a mine row on at least one side. Only the middle of a 3 wide board fails this
  const positions = [];
  for (let position = 0; position < crossSize; position++) {
    if (position >= 2 || position <= crossSize - 3) {
      positions.push(position);
    }
  }
  const linePosition = rng.pick(positions);
  const pattern = createMinePattern(length, rng);

  const cellAt = (alongLine, across) =>
    isHorizontal ? { x: alongLine, y: across } : { x: across, y: alongLine };

  const lineCells = [];
  const mineCells = [];
  for (let i = 0; i < length; i++) {
    lineCells.push(cellAt(i, linePosition));
    if (pattern[i]) {
      for (const side of [-1, 1]) {
        const across = linePosition + side;
        if (across >= 0 && across < crossSize) {
          mineCells.push(cellAt(i, across));
        }
      }
    }
  }

  const mines = minesFromCells(width, height, mineCells);

  return {
    mines,
    initialTiles: revealAllExcept(mines, lineCells),
    targets: lineCells.map((cell) => ({ x: cell.x, y: cell.y, kind: "click" })),
    meta: {
      orientation,
      linePosition,
      pattern: pattern.map((isMine) => (isMine ? "X" : "o")).join(""),
    },
  };
}
