import CONSTANTS from "src/includes/Constants";

//Shared helpers for practice generators. Grids use the board convention grid[tileX][tileY].

export function createGrid(width, height, value) {
  return Array.from({ length: width }, () => new Array(height).fill(value));
}

export function inBounds(width, height, tileX, tileY) {
  return tileX >= 0 && tileX < width && tileY >= 0 && tileY < height;
}

export function countNeighbourMines(mines, tileX, tileY) {
  const width = mines.length;
  const height = mines[0].length;
  let count = 0;
  for (let x = tileX - 1; x <= tileX + 1; x++) {
    for (let y = tileY - 1; y <= tileY + 1; y++) {
      if ((x !== tileX || y !== tileY) && inBounds(width, height, x, y)) {
        count += mines[x][y] ? 1 : 0;
      }
    }
  }
  return count;
}

export function minesFromCells(width, height, mineCells) {
  const mines = createGrid(width, height, false);
  for (const cell of mineCells) {
    mines[cell.x][cell.y] = true;
  }
  return mines;
}

//Initial tile states where every safe tile is revealed, except those listed in hiddenCells.
//Mines always start unrevealed unless listed in flaggedCells.
export function revealAllExcept(mines, hiddenCells = [], flaggedCells = []) {
  const width = mines.length;
  const height = mines[0].length;
  const tiles = createGrid(width, height, CONSTANTS.UNREVEALED);
  const hidden = new Set(hiddenCells.map((c) => `${c.x},${c.y}`));

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (!mines[x][y] && !hidden.has(`${x},${y}`)) {
        tiles[x][y] = countNeighbourMines(mines, x, y);
      }
    }
  }

  for (const cell of flaggedCells) {
    tiles[cell.x][cell.y] = CONSTANTS.FLAG;
  }

  return tiles;
}

//Revealed zeros next to hidden safe tiles would open them when chorded, which breaks most scenarios.
export function findZeroLeaks(mines, initialTiles) {
  const width = mines.length;
  const height = mines[0].length;
  const leaks = [];

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (initialTiles[x][y] !== 0) {
        continue;
      }
      for (let i = x - 1; i <= x + 1; i++) {
        for (let j = y - 1; j <= y + 1; j++) {
          if (
            inBounds(width, height, i, j) &&
            !mines[i][j] &&
            initialTiles[i][j] === CONSTANTS.UNREVEALED
          ) {
            leaks.push({ x, y });
          }
        }
      }
    }
  }

  return leaks;
}

export function validateGeneratedBoard(result, width, height) {
  const errors = [];

  if (
    !Array.isArray(result?.mines) ||
    result.mines.length !== width ||
    result.mines.some((column) => column.length !== height)
  ) {
    errors.push("mines must be a width x height grid");
  }

  if (
    !Array.isArray(result?.initialTiles) ||
    result.initialTiles.length !== width ||
    result.initialTiles.some((column) => column.length !== height)
  ) {
    errors.push("initialTiles must be a width x height grid");
  }

  if (errors.length === 0) {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const state = result.initialTiles[x][y];
        if (result.mines[x][y] && typeof state === "number") {
          errors.push(`mine at (${x}, ${y}) cannot start revealed`);
        }
        if (
          !result.mines[x][y] &&
          typeof state === "number" &&
          state !== countNeighbourMines(result.mines, x, y)
        ) {
          errors.push(`tile (${x}, ${y}) shows the wrong number`);
        }
      }
    }

    if (findZeroLeaks(result.mines, result.initialTiles).length > 0) {
      errors.push("a revealed zero touches a hidden safe tile");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid practice board: ${errors.join("; ")}`);
  }
}
