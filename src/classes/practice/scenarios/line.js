//Line: a whole row or column is hidden. Click every square along it, in any order, as fast as possible.

import { firstStartChoices, betweenStartChoices } from "./startStyles";

export default {
  id: "line",
  version: 1,
  name: "Line",
  category: "Aim",
  description:
    "A whole row or column of safe squares is hidden between two rows of mines. Click every square along the line as fast as you can, in any order.",
  board: { allowUserSize: true, minWidth: 3, minHeight: 3 },
  generator: {
    type: "line",
    params: { direction: { $option: "direction" } },
  },
  rounds: { $option: "rounds" },
  start: {
    first: { $option: "firstStart" },
    between: { $option: "betweenStart" },
  },
  completion: { type: "all-safe-revealed" },
  onMine: "lose",
  metrics: [
    {
      type: "timeToClick",
      label: "Time to clear",
      description:
        "Time from the board appearing until you cleared the last square of the line, measured at button release.",
    },
    { type: "misclicks" },
    { type: "path" },
  ],
  rawvfMode: "Practice: Line",
  options: [
    {
      key: "rounds",
      type: "select",
      label: "Rounds",
      default: 5,
      choices: [1, 3, 5, 10, 20],
    },
    {
      key: "direction",
      type: "select",
      label: "Direction",
      default: "mixed",
      choices: [
        { label: "Mixed (random each round)", value: "mixed" },
        { label: "Horizontal", value: "horizontal" },
        { label: "Vertical", value: "vertical" },
      ],
    },
    {
      key: "firstStart",
      type: "select",
      label: "First round start",
      default: "countdown",
      choices: firstStartChoices,
    },
    {
      key: "betweenStart",
      type: "select",
      label: "Between rounds",
      default: "random",
      choices: betweenStartChoices,
    },
  ],
};
