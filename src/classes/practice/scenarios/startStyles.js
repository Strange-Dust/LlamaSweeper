//Start-style choices shared by scenarios. Each choice's `resolved` is a whole StartStyle, see README.md.

//How the first round of a set starts. Always waits for the start button, which also gives the cursor a known origin.
export const firstStartChoices = [
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

//How later rounds of a set start, after the previous round ends.
export const betweenStartChoices = [
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
