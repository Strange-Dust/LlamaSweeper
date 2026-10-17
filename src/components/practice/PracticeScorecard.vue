<template>
  <q-card
    square
    style="float: left; margin-bottom: 10px; width: 330px; max-width: 100%"
    id="practice-scorecard"
  >
    <q-card-section class="q-pb-sm">
      <div class="text-h6">{{ results.scenarioName }}</div>
      <div class="text-caption">{{ statusText }}</div>
    </q-card-section>

    <q-separator />

    <q-card-section v-if="isSingleRound && lastRound" class="q-py-sm">
      <div class="text-subtitle2 q-mb-xs">
        <span class="practice-help"
          >Result <PracticeTooltip>{{ tooltips.result }}</PracticeTooltip></span
        >
        <q-badge
          class="q-ml-xs"
          :color="lastRound.outcome === 'won' ? 'positive' : 'negative'"
          :label="lastRound.outcome === 'won' ? 'Won' : 'Lost'"
        />
        <q-badge
          v-if="lastRound.penalties > 0"
          class="q-ml-xs"
          color="warning"
          text-color="black"
          :label="`${lastRound.penalties} penalty`"
        >
          <PracticeTooltip>{{ tooltips.penalty }}</PracticeTooltip>
        </q-badge>
      </div>
      <div
        v-for="metric in lastRoundMetrics"
        :key="metric.key"
        class="row justify-between"
      >
        <span class="practice-help"
          >{{ metric.label }}
          <PracticeTooltip>{{ metric.description }}</PracticeTooltip></span
        >
        <span class="practice-value">{{
          formatMetricValue(metric.value, metric.unit)
        }}</span>
      </div>
    </q-card-section>

    <template v-if="results.summary && !isSingleRound">
      <q-card-section class="q-py-sm">
        <div class="text-subtitle2 practice-help">
          Summary ({{ results.summary.wins }}/{{ results.summary.total }} won)
          <PracticeTooltip>{{ tooltips.summary }}</PracticeTooltip>
        </div>
        <q-markup-table dense flat class="practice-table q-mt-xs">
          <thead>
            <tr>
              <th class="text-left">Metric</th>
              <th class="text-right practice-help">
                Mean
                <PracticeTooltip>{{ tooltips.mean }}</PracticeTooltip>
              </th>
              <th class="text-right practice-help">
                Median
                <PracticeTooltip>{{ tooltips.median }}</PracticeTooltip>
              </th>
              <th class="text-right practice-help">
                Best
                <PracticeTooltip>{{ tooltips.best }}</PracticeTooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in summaryMetrics" :key="metric.key">
              <td class="text-left practice-help">
                {{ labelWithUnit(metric) }}
                <PracticeTooltip>{{ metric.description }}</PracticeTooltip>
              </td>
              <td class="text-right practice-value">
                {{ formatMetricNumber(metric.mean, metric.unit) }}
              </td>
              <td class="text-right practice-value">
                {{ formatMetricNumber(metric.median, metric.unit) }}
              </td>
              <td class="text-right practice-value">
                {{ formatMetricNumber(metric.best, metric.unit) }}
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </q-card-section>

      <q-expansion-item dense label="All rounds" header-class="text-subtitle2">
        <q-markup-table dense flat class="practice-table q-mx-sm q-mb-sm">
          <thead>
            <tr>
              <th class="text-left">#</th>
              <th class="text-left practice-help">
                Result
                <PracticeTooltip>{{ tooltips.result }}</PracticeTooltip>
              </th>
              <th
                v-for="metric in results.rounds[0].metrics"
                :key="metric.key"
                class="text-right practice-help"
              >
                {{ labelWithUnit(metric) }}
                <PracticeTooltip>{{ metric.description }}</PracticeTooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="round in results.rounds" :key="round.index">
              <td class="text-left">{{ round.index + 1 }}</td>
              <td class="text-left">
                {{ round.outcome === "won" ? "Won" : "Lost" }}
                <PracticeTooltip v-if="round.penalties > 0"
                  >{{ round.penalties }} penalty.
                  {{ tooltips.penalty }}</PracticeTooltip
                >
              </td>
              <td
                v-for="metric in round.metrics"
                :key="metric.key"
                class="text-right practice-value"
              >
                {{ formatMetricNumber(metric.value, metric.unit) }}
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </q-expansion-item>
    </template>

    <q-separator />

    <q-card-section class="row justify-center q-gutter-sm screenshot-hidden">
      <q-btn-dropdown color="primary" label="Export">
        <PracticeTooltip
          >Save or analyse this set's replay data.</PracticeTooltip
        >
        <q-list>
          <q-item clickable v-close-popup @click="downloadRawVf()">
            <q-item-section>
              <q-item-label>RawVF Download</q-item-label>
            </q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="sendToAnalyser()">
            <q-item-section>
              <q-item-label>StrangeDust Analyser</q-item-label>
            </q-item-section>
          </q-item>
          <q-item
            clickable
            v-close-popup
            @click="game.board.boardImportExport.showExportScreenshotDialogue()"
          >
            <q-item-section>
              <q-item-label>Copy Screenshot</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <q-btn
        v-if="devMode"
        flat
        color="secondary"
        label="Dump data"
        @click="dumpRoundData()"
      />
    </q-card-section>

    <q-expansion-item
      v-if="showStatsBlock"
      dense
      label="Board stats (last round)"
      header-class="text-subtitle2 screenshot-hidden"
    >
      <div class="clearfix q-px-sm">
        <StatsPanel />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<style scoped>
.practice-value {
  font-family: monospace;
}

.practice-help {
  cursor: help;
}

.practice-help:hover {
  text-decoration: underline dotted;
}

.practice-table {
  background: transparent;
}

.practice-table th,
.practice-table td {
  padding-left: 4px;
  padding-right: 4px;
}
</style>

<script setup>
import { computed, inject } from "vue";
import { Dialog } from "quasar";
import StatsPanel from "src/components/StatsPanel.vue";
import PracticeTooltip from "src/components/practice/PracticeTooltip.vue";
import RawVF from "src/classes/RawVF";
import {
  formatMetricValue,
  formatMetricNumber,
  getMetricUnitLabel,
} from "src/classes/practice";
import { practiceResults, showStatsBlock } from "src/composables/useSettings";

defineOptions({
  name: "PracticeScorecard",
});

const game = inject("game");
const devMode = localStorage.getItem("devMode") === "1";

const results = computed(() => practiceResults.value);
const lastRound = computed(() => results.value.rounds.at(-1) ?? null);

//Hide metrics with no data (e.g. cursor metrics on touch) rather than showing dashes
const lastRoundMetrics = computed(
  () => lastRound.value?.metrics.filter((m) => m.value !== null) ?? []
);
const summaryMetrics = computed(
  () => results.value.summary?.metrics.filter((m) => m.count > 0) ?? []
);

const statusText = computed(() =>
  results.value.totalRounds > 1
    ? `Set complete (${results.value.totalRounds} rounds). Press space or the face for a new set.`
    : "Round complete. Press space or the face to go again."
);

const isSingleRound = computed(() => results.value.totalRounds === 1);

const tooltips = {
  result: "Won if you cleared the round, Lost if you hit a mine.",
  penalty:
    "Mines hit during the round that did not end it. Only some scenarios allow this.",
  summary:
    "Combined results for the whole set. Rounds that you lost still count towards the averages.",
  mean: "Average across the rounds where this metric could be measured.",
  median:
    "Middle value across the rounds. Less affected by one unusually good or bad round than the mean.",
  best: "Your best round for this metric.",
};

function labelWithUnit(metric) {
  const unit = getMetricUnitLabel(metric.unit);
  return unit ? `${metric.label} (${unit})` : metric.label;
}

function getRounds() {
  return game.board.practice.getCompletedRounds();
}

function downloadRawVf() {
  const rounds = getRounds();
  if (rounds.length === 0) {
    return;
  }
  Dialog.create({
    title: "Download Started",
    message:
      "Practice RawVF files contain one section per round and include board events. They are intended for StrangeDust's Replay Analyser and may not work with other viewers.",
  });
  RawVF.downloadPracticeRawVf(rounds);
}

function sendToAnalyser() {
  const rounds = getRounds();
  if (rounds.length > 0) {
    RawVF.sendPracticeToStrangeDust(rounds);
  }
}

function dumpRoundData() {
  //Dev-only check that gameplay data was captured as expected
  const rounds = getRounds();
  const rawVfText = RawVF.createPracticeRawVfText(rounds);
  console.log("Practice round records", rounds);
  console.log(rawVfText);
  const preview =
    rawVfText.length > 6000 ? rawVfText.slice(0, 6000) + "\n…" : rawVfText;
  Dialog.create({
    title: "Practice data (also logged to console)",
    message: `<pre style="max-height: 60vh; overflow: auto; font-size: 11px">${preview}</pre>`,
    html: true,
    style: "max-width: 95vw",
  });
}
</script>
