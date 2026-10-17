import PracticeRegistry from "../PracticeRegistry";

//Turns a scenario's metric references into values for one round, and aggregates them for a set.
//A metric reference is { type, params?, key?, label? }; key defaults to type so the same metric
//can be listed twice with different params (e.g. press and release timing).

export function computeMetrics(metricRefs, record) {
  return metricRefs.map((ref) => {
    const metric = PracticeRegistry.getMetric(ref.type);
    let value = null;
    try {
      value = metric.compute(record, ref.params ?? {});
    } catch (error) {
      console.error(`Practice metric "${ref.type}" failed`, error);
    }
    return {
      key: ref.key ?? ref.type,
      label: ref.label ?? metric.label,
      unit: metric.unit,
      better: metric.better,
      description: ref.description ?? metric.description ?? "",
      value: Number.isFinite(value) ? value : null,
    };
  });
}

function median(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 1
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

export function summariseRounds(rounds) {
  const total = rounds.length;
  const wins = rounds.filter((r) => r.outcome === "won").length;

  if (total === 0) {
    return { total, wins, metrics: [] };
  }

  const metrics = rounds[0].metrics.map((first) => {
    const values = rounds
      .map((r) => r.metrics.find((m) => m.key === first.key)?.value)
      .filter((v) => v !== null && v !== undefined)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return { ...first, count: 0, mean: null, median: null, best: null };
    }

    return {
      key: first.key,
      label: first.label,
      unit: first.unit,
      better: first.better,
      description: first.description,
      count: values.length,
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      median: median(values),
      best: first.better === "higher" ? values.at(-1) : values[0],
    };
  });

  return { total, wins, metrics };
}

export function formatMetricValue(value, unit) {
  if (value === null || value === undefined) {
    return "–";
  }
  switch (unit) {
    case "seconds":
      return `${Math.round(value * 1000)} ms`;
    case "pixels":
      return String(Math.round(value));
    case "percent":
      return `${value.toFixed(1)}%`;
    case "count":
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    default:
      return String(Math.round(value * 1000) / 1000);
  }
}

//Number only, for tables where the unit is shown in the row/column label
export function formatMetricNumber(value, unit) {
  if (value === null || value === undefined) {
    return "–";
  }
  switch (unit) {
    case "seconds":
      return String(Math.round(value * 1000));
    case "pixels":
      return String(Math.round(value));
    case "percent":
      return value.toFixed(1);
    default:
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
}

//Pixel paths are written as Path(n) with no unit, so only some units add a suffix to labels
export function getMetricUnitLabel(unit) {
  return { seconds: "ms", percent: "%" }[unit] ?? "";
}
