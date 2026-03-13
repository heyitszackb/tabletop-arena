# TODOs

## Sound Effects
**What:** Add sound effects for dice rolls, card flips, and shuffling.
**Why:** Sound is a huge part of what makes tabletop apps feel satisfying and tactile. Without it, interactions feel flat.
**Effort:** S-M (need to source/license audio, implement Web Audio API or `<audio>` elements, handle mute toggle and browser autoplay restrictions)
**Priority:** P2
**Where to start:** Find free CC0 sound packs, create a `useSoundEffects` hook, trigger sounds from action callbacks in `useSocket`.
