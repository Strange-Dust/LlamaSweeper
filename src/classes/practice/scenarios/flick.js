//Flick: the board is fully revealed except one safe square to click as fast as possible.

const startChoices = [
  {
    label: "3-2-1 countdown",
    value: "countdown",
    resolved: { trigger: "button", timing: { countdown: 3, delay: 0 } },
  },
  {
    label: "Random delay (reflex)",
    value: "random",
    resolved: {
      trigger: "button",
      timing: { countdown: 0, delay: { min: 1000, max: 3000 } },
    },
  },
  {
    label: "Immediately",
    value: "immediate",
    resolved: { trigger: "button", timing: { countdown: 0, delay: 0 } },
  },
];

const betweenChoices = [
  {
    label: "Random delay 0.5–2s",
    value: "random",
    resolved: {
      trigger: "auto",
      holdMs: 0,
      timing: { countdown: 0, delay: { min: 500, max: 2000 } },
    },
  },
  {
    label: "Immediately",
    value: "immediate",
    resolved: {
      trigger: "auto",
      holdMs: 0,
      timing: { countdown: 0, delay: 0 },
    },
  },
  {
    label: "3-2-1 countdown",
    value: "countdown",
    resolved: {
      trigger: "auto",
      holdMs: 0,
      timing: { countdown: 3, delay: 0 },
    },
  },
  {
    label: "Start button",
    value: "button",
    resolved: {
      trigger: "button",
      holdMs: 0,
      timing: { countdown: 0, delay: 0 },
    },
  },
];

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
  metrics: [
    { type: "timeToClick" },
    { type: "reactionTime" },
    { type: "movementTime" },
    { type: "misclicks" },
    { type: "pathLength" },
    { type: "pathEfficiency" },
  ],
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
      choices: startChoices,
    },
    {
      key: "betweenStart",
      type: "select",
      label: "Between rounds",
      default: "random",
      choices: betweenChoices,
    },
  ],
};
