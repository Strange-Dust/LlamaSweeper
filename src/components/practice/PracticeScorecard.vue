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

    <q-card-section v-if="lastRound" class="q-py-sm">
      <div class="text-subtitle2 q-mb-xs">
        Round {{ lastRound.index + 1 }}
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
        />
      </div>
      <div
        v-for="metric in lastRoundMetrics"
        :key="metric.key"
        class="row justify-between"
      >
        <span>{{ metric.label }}</span>
        <span class="practice-value">{{
          formatMetricValue(metric.value, metric.unit)
        }}</span>
      </div>
    </q-card-section>

    <template v-if="results.summary && results.rounds.length > 1">
      <q-separator />
      <q-card-section class="q-py-sm">
        <div class="text-subtitle2">
          Summary ({{ results.summary.wins }}/{{ results.summary.total }} won)
        </div>
        <q-markup-table dense flat class="practice-table q-mt-xs">
          <thead>
            <tr>
              <th class="text-left">Metric</th>
              <th class="text-right">Mean</th>
              <th class="text-right">Median</th>
              <th class="text-right">Best</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in summaryMetrics" :key="metric.key">
              <td class="text-left">{{ labelWithUnit(metric) }}</td>
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
              <th class="text-left">Result</th>
              <th
                v-for="metric in results.rounds[0].metrics"
                :key="metric.key"
                class="text-right"
              >
                {{ labelWithUnit(metric) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="round in results.rounds" :key="round.index">
              <td class="text-left">{{ round.index + 1 }}</td>
              <td class="text-left">
                {{ round.outcome === "won" ? "Won" : "Lost" }}
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

const statusText = computed(() => {
  const done = results.value.rounds.length;
  const total = results.value.totalRounds;
  if (results.value.complete) {
    return total > 1
      ? "Set complete. Press space or the face for a new set."
      : "Round complete. Press space or the face to go again.";
  }
  return `Round ${done} of ${total} complete`;
});

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
