/*
  Aim-focused metrics. Each metric is a pure function of a finished round record.
  Times are in seconds relative to the moment the board was revealed (time 0).
  Positions are unfloored tile coordinates.

  params.timing: "release" (default, matches when minesweeper registers the click) | "press"
*/

const EFFECTIVE_DIG_TYPES = ["left", "chord"];

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function completingClick(record) {
  if (record.outcome !== "won") {
    return null;
  }
  for (let i = record.clicks.length - 1; i >= 0; i--) {
    if (EFFECTIVE_DIG_TYPES.includes(record.clicks[i].type)) {
      return record.clicks[i];
    }
  }
  return null;
}

//Latest button press at or before the click's release. Touch rounds have no button events so use the release.
function clickTimeFor(record, click, timing) {
  if (timing !== "press") {
    return click.time;
  }
  let press = null;
  for (const buttonEvent of record.buttonEvents) {
    if (buttonEvent.time > click.time) {
      break;
    }
    if (buttonEvent.isDown) {
      press = buttonEvent;
    }
  }
  return press ? press.time : click.time;
}

function movesBetween(record, startTime, endTime) {
  return record.moves.filter((m) => m.time >= startTime && m.time <= endTime);
}

function pathPoints(record) {
  const click = completingClick(record);
  if (!click || !record.startCursor) {
    return null;
  }
  const points = [record.startCursor];
  for (const move of movesBetween(record, 0, click.time)) {
    points.push({ x: move.xRaw, y: move.yRaw });
  }
  points.push({ x: click.xRaw, y: click.yRaw });
  return points;
}

function pathLengthInTiles(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
}

export const timeToClick = {
  id: "timeToClick",
  label: "Time to click",
  unit: "seconds",
  better: "lower",
  description:
    "Time from the board appearing until the click that completed the round, measured at button release.",
  compute(record, params = {}) {
    const click = completingClick(record);
    return click ? clickTimeFor(record, click, params.timing) : null;
  },
};

export const misclicks = {
  id: "misclicks",
  label: "Misclicks",
  unit: "count",
  better: "lower",
  description:
    "Clicks that did nothing, such as clicking an already revealed square.",
  compute(record) {
    return record.clicks.filter((c) => c.type.startsWith("wasted")).length;
  },
};

//Path is conventionally measured in pixels normalised to a 16px square size,
//so it doesn't depend on the player's tile size. Positions are in tile units, so that's tiles * 16.
const NORMALISED_SQUARE_SIZE = 16;

export const normalisedPath = {
  id: "path",
  label: "Path(n)",
  unit: "pixels",
  better: "lower",
  description:
    "Distance the cursor travelled between the board appearing and the completing click, in pixels normalised to a 16px square size.",
  compute(record) {
    const points = pathPoints(record);
    return points ? pathLengthInTiles(points) * NORMALISED_SQUARE_SIZE : null;
  },
};

export default [timeToClick, misclicks, normalisedPath];
