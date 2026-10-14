//Small seedable PRNG (mulberry32) so a practice board can be regenerated from its seed.

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 32);
}

export function createRng(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    seed,
    next,
    //Inclusive of both min and max
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(array) {
      if (array.length === 0) {
        throw new Error("Cannot pick from an empty array");
      }
      return array[Math.floor(next() * array.length)];
    },
  };
}
