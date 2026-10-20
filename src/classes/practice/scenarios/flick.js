//Flick: the board is fully revealed except one safe square to click as fast as possible.

import { firstStartChoices, betweenStartChoices } from "./startStyles";

export default {
  id: "flick",
  version: 1,
  name: "Flick",
  category: "Aim",
  description:
    "The board appears fully revealed except for one small spot. Click the safe square as fast as you can.",
  board: { allowUserSize: true, minWidth: 3, minHeight: 3 },
  generator: {
    type: "single-target",
    params: { pattern: { $option: "pattern" } },
  },
  rounds: { $option: "rounds" },
  start: {
    first: { $option: "firstStart" },
    between: { $option: "betweenStart" },
  },
  completion: { type: "all-safe-revealed" },
  onMine: "lose",
  metrics: [{ type: "timeToClick" }, { type: "misclicks" }, { type: "path" }],
  rawvfMode: "Practice: Flick",
  options: [
    {
      key: "rounds",
      type: "select",
      label: "Rounds",
      default: 10,
      choices: [1, 5, 10, 20, 50],
    },
    {
      key: "pattern",
      type: "select",
      label: "Target",
      default: "mixed",
      choices: [
        { label: "Mixed", value: "mixed" },
        { label: "Mine-safe-mine (1-2-1)", value: "line" },
        { label: "Corner", value: "corner" },
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
