import PracticeRegistry from "./PracticeRegistry";

/*
  Turns a scenario definition plus the user's option values into a concrete runnable config.

  Anywhere in a definition, `{ $option: "key" }` is replaced by the chosen value of that option.
  For select options a choice may carry `resolved` (any data, e.g. a whole start style) which is
  substituted instead of the stored primitive `value`. Primitive values keep localStorage simple.

  Option schema: { key, type: "select" | "number" | "toggle", label, default,
                   choices?: [{ label, value, resolved? }], min?, max?, step?, hint? }
*/

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

const START_TRIGGERS = ["button", "auto"];
const ON_MINE_BEHAVIOURS = ["lose", "continue"];

function normaliseChoice(choice) {
  return typeof choice === "object" && choice !== null
    ? choice
    : { label: String(choice), value: choice };
}

export function getOptionChoices(option) {
  return (option.choices ?? []).map(normaliseChoice);
}

export function getOptionValues(definition, storedValues = {}) {
  const values = {};
  for (const option of definition.options ?? []) {
    const stored = storedValues[option.key];
    values[option.key] = isValidOptionValue(option, stored)
      ? stored
      : option.default;
  }
  return values;
}

function isValidOptionValue(option, value) {
  if (value === undefined || value === null) {
    return false;
  }
  switch (option.type) {
    case "select":
      return getOptionChoices(option).some((c) => c.value === value);
    case "number":
      return (
        Number.isFinite(value) &&
        (option.min === undefined || value >= option.min) &&
        (option.max === undefined || value <= option.max)
      );
    case "toggle":
      return typeof value === "boolean";
    default:
      return false;
  }
}

function bindOptions(node, definition, values) {
  if (Array.isArray(node)) {
    return node.map((item) => bindOptions(item, definition, values));
  }
  if (node === null || typeof node !== "object") {
    return node;
  }
  if (hasOwn(node, "$option")) {
    const option = (definition.options ?? []).find(
      (o) => o.key === node.$option
    );
    if (!option) {
      throw new Error(`Unknown option reference "${node.$option}"`);
    }
    const value = values[option.key];
    if (option.type === "select") {
      const choice = getOptionChoices(option).find((c) => c.value === value);
      if (choice && hasOwn(choice, "resolved")) {
        return bindOptions(
          structuredClone(choice.resolved),
          definition,
          values
        );
      }
    }
    return value;
  }

  const result = {};
  for (const [key, child] of Object.entries(node)) {
    result[key] = bindOptions(child, definition, values);
  }
  return result;
}

function normaliseStartStyle(style, label, errors) {
  if (!style || typeof style !== "object") {
    errors.push(`${label} must be an object`);
    return null;
  }
  const normalised = {
    trigger: style.trigger ?? "button",
    holdMs: style.holdMs ?? 0,
    //Lost boards stay visible a little longer so the player can see what happened
    holdAfterLossMs: style.holdAfterLossMs ?? 750,
    timing: {
      countdown: style.timing?.countdown ?? 0,
      delay: style.timing?.delay ?? 0,
    },
  };
  if (!START_TRIGGERS.includes(normalised.trigger)) {
    errors.push(`${label}.trigger must be one of ${START_TRIGGERS.join(", ")}`);
  }
  if (
    !Number.isInteger(normalised.timing.countdown) ||
    normalised.timing.countdown < 0
  ) {
    errors.push(`${label}.timing.countdown must be a whole number of seconds`);
  }
  const delay = normalised.timing.delay;
  const isValidDelay =
    (Number.isFinite(delay) && delay >= 0) ||
    (Number.isFinite(delay?.min) &&
      Number.isFinite(delay?.max) &&
      delay.min >= 0 &&
      delay.max >= delay.min);
  if (!isValidDelay) {
    errors.push(`${label}.timing.delay must be milliseconds or { min, max }`);
  }
  if (!Number.isFinite(normalised.holdMs) || normalised.holdMs < 0) {
    errors.push(`${label}.holdMs must be a non-negative number`);
  }
  if (
    !Number.isFinite(normalised.holdAfterLossMs) ||
    normalised.holdAfterLossMs < 0
  ) {
    errors.push(`${label}.holdAfterLossMs must be a non-negative number`);
  }
  return normalised;
}

export function resolveScenario(definition, values) {
  const errors = [];
  const { options, hooks, ...rest } = definition;
  const bound = bindOptions(rest, definition, values);

  const rounds = bound.rounds ?? 1;
  if (!Number.isInteger(rounds) || rounds < 1) {
    errors.push("rounds must be a positive whole number");
  }

  const board = bound.board ?? {};
  if (
    !board.allowUserSize &&
    (!Number.isInteger(board.width) || !Number.isInteger(board.height))
  ) {
    errors.push(
      "board.width and board.height are required unless board.allowUserSize is set"
    );
  }

  if (!PracticeRegistry.getGenerator(bound.generator?.type)) {
    errors.push(`unknown generator "${bound.generator?.type}"`);
  }

  const completion = bound.completion ?? { type: "all-safe-revealed" };
  if (!PracticeRegistry.getCompletionRule(completion.type)) {
    errors.push(`unknown completion rule "${completion.type}"`);
  }

  const onMine = bound.onMine ?? "lose";
  if (!ON_MINE_BEHAVIOURS.includes(onMine)) {
    errors.push(`onMine must be one of ${ON_MINE_BEHAVIOURS.join(", ")}`);
  }

  const metrics = bound.metrics ?? [];
  for (const ref of metrics) {
    if (!PracticeRegistry.getMetric(ref.type)) {
      errors.push(`unknown metric "${ref.type}"`);
    }
  }

  const first = normaliseStartStyle(
    bound.start?.first ?? {},
    "start.first",
    errors
  );
  const between = normaliseStartStyle(
    bound.start?.between ?? bound.start?.first ?? {},
    "start.between",
    errors
  );

  if (errors.length > 0) {
    throw new Error(
      `Practice scenario "${definition.id}" is invalid: ${errors.join("; ")}`
    );
  }

  return {
    ...bound,
    rounds,
    board,
    generator: {
      type: bound.generator.type,
      params: bound.generator.params ?? {},
    },
    completion: { type: completion.type, params: completion.params ?? {} },
    onMine,
    metrics,
    start: { first, between },
    hooks: hooks ?? {},
    optionValues: values,
  };
}

export function getOptionStorageKey(definition) {
  return `${definition.id}@v${definition.version ?? 1}`;
}
