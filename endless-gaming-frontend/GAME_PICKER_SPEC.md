## ⚡ Spec Headline

### Problem

Steam’s catalogue is vast; players struggle to find games that match their tastes.

### Solution (UX) – a Max-Diff-style discovery flow

1. **Pairwise choice loop** – show two games at a time; user clicks the one that appeals more (or *Skip*).
2. **Hidden attribute inference** – each game’s Steam tags act as attributes; every pick adds evidence to an internal preference model.
3. **Live feedback** – a small sidebar chart surfaces the user’s top-liked and top-disliked tags in real time.
4. **Progress bar** – after \~20 comparisons the loop ends.
5. **Personal shortlist** – a scrollable list of the top 100 games ranked by the learned preference vector.

The experience mirrors a textbook MaxDiff survey: forced best/worst (here, best/skip/worst) yields clear signal, low cognitive load, and interesting feedback in minutes.

---

## Solution (technical) – client-side intelligence, minimal backend

*Backend endpoints*

```
GET  /games/master.json   // full dump, includes tag vote counts for every game
POST /choices             // write-only, logs user picks for analytics
```

*Key data shape (pseudocode)*

```ts
interface GameRecord {
  appId: number;
  name: string;
  coverUrl: string;
  price: string;                    // "0" = Free
  tags: { [tag: string]: number };  // vote counts
  // …other SteamSpy fields
}
interface ChoiceEvent { leftId: number; rightId: number; pick: 'left'|'right'|'skip'; ts: number; }
```

*Schemas and code throughout this spec are **conceptual**; rename or refactor as needed for clean, pragmatic implementation.*

*Client workflow*

1. **Load & cache** `master.json` (≈ 500 kB gzip) via `fetch()`; store in IndexedDB.
2. **Normalise tags** per game (`votes / maxVotes`); build a global `tag→index` map once.
3. **Represent games** as sparse vectors `{ idx: Uint16Array, val: Float32Array }`.
4. **Keep a dense weight vector** `w: Float32Array(D)` (one element per tag).
5. **On each pick** perform a single-step logistic SGD update on `w`.
6. **Select next pair** by uncertainty sampling (closest to 50 % win probability) with a diversity penalty.
7. **Rank games** via `score = dotSparse(game, w)` and maintain the top 100 in a priority queue.
8. **Persist** weight vector, progress count, and offline choice queue in IndexedDB; resume seamlessly after reload.
9. **Fire-and-forget analytics** – enqueue `ChoiceEvent` locally, flush when online.

*Angular architecture*

```
GamePickerModule
 ├─ services/
 │   ├─ game-data.service.ts      // load, cache, expose GameRecord map
 │   ├─ vector.service.ts         // tag dictionary & sparse converters
 │   ├─ preference.service.ts     // weight vector, SGD, top tags stream
 │   ├─ pair.service.ts           // uncertainty sampler, candidate heap
 │   └─ choice-api.service.ts     // offline queue, POST /choices
 └─ components/
     ├─ game-picker-page.component.ts   // shell
     ├─ game-comparison.component.ts    // two cards + buttons
     ├─ game-card.component.ts          // cover, tag chips, details
     ├─ preference-summary.component.ts // radar/bar of ±tags
     ├─ recommendation-list.component.ts// virtual scroll list
     └─ progress-bar.component.ts       // 0–20 comparisons
```

---

## Recommended libraries

| Library (npm)         | Purpose                                                                                           | Size (gzip) |
| --------------------- | ------------------------------------------------------------------------------------------------- | ----------- |
| **Dexie.js**          | Robust, minimal IndexedDB wrapper for storing the master dump and user state without boilerplate. | \~29 kB     |
| **fastpriorityqueue** | Micro-heap used to maintain the top-scoring games efficiently.                                    | \~2 kB      |
| **vectorious**        | Typed-array algebra (`dot`, `scale`), keeping vector math concise and reliable.                   | \~14 kB     |



---

Feel free to adjust naming and method signatures to keep your implementation elegant and pragmatic.
