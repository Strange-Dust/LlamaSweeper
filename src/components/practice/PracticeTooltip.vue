<template>
  <q-tooltip
    anchor="top middle"
    self="bottom middle"
    max-width="280px"
    :delay="150"
    style="font-size: 13px"
  >
    <slot />
  </q-tooltip>
</template>

<script setup>
defineOptions({
  name: "PracticeTooltip",
});
</script>
