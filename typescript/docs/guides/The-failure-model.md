---
title: The failure model
---

# The failure model

The library distinguishes *"there is no such thing"* from *"you passed me nonsense"* from
*"I do not have the data"*, and each gets a different shape. Once you know the four, you
can write a consumer that never guesses.

## The four outcomes

| Outcome | Means | Example |
| --- | --- | --- |
| `null` | Nothing matched, or the input did not parse as that kind of thing | `getShipBySymbol('nope')` |
| `TypeError` | The input was malformed | `toSystemAddress(2 ** 53)` |
| `RangeError` | Well-formed, but outside a supported range | `massCodeToSizeClass('z')` |
| `SyntaxError` | The text was not JSON | `parseSlef('{')` |

```ts
import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
import { toSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address-input';
import { parseSlef } from '@elite-dangerous-almanac/core/ships/slef';

getShipBySymbol('no such hull'); // -> null, an ordinary answer

try {
    toSystemAddress(2 ** 53); // a number too large to be exact
} catch (error) {
    error instanceof TypeError; // -> true
}

try {
    parseSlef('{'); // JSON.parse fails before anything else runs
} catch (error) {
    error instanceof SyntaxError; // -> true
}
```

**`null` is not an error.** A lookup that finds nothing has answered you. Journals
outlive catalogues — a game update ships modules before this package knows about them —
so `null` from a symbol lookup usually means "newer than the catalogue", and a consumer
that treats it as a crash will break on every game update.

For input you do not control, prefer the `try…` form where one exists, which converts a
throw into a `null`:

```ts
import { toSystemAddress, tryToSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address-input';

toSystemAddress('3309179996515'); // -> 3309179996515n, throws on bad input
tryToSystemAddress('not an address'); // -> null, never throws
```

## Nullable value, or diagnostic result?

Aggregate figures that depend on catalogue data come in pairs. The property is the
convenience; the `…Result` is what you show a user when the convenience is `null`.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

build.cargoCapacity; // number | null
build.cargoCapacityResult; // the value, plus every rack it could not classify

build.unladenMass;
build.unladenMassResult;
build.fuelCapacity;
build.fuelCapacityResult;
```

The reason for the pair is that the alternative is worse: an unclassifiable cargo rack
counted as zero would produce a plausible, wrong total that no one would question. A
`null` with a list of what was missing cannot be mistaken for an answer.

**Absent is not zero, anywhere in the library.** A catalogue field the source did not
carry is omitted rather than defaulted, and a capture that priced no module for a slot
reports `null` rather than `0` — a cockpit no journal prices was not free.

## `valid` against `complete`

Two different questions about a build, deliberately kept apart:

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

build.validation.valid; // is the fit structurally legal?
build.validation.complete; // every operational mount present and fully classified?
build.validation.issues; // what specifically
```

Each issue carries a stable `code` and a `severity`:

- **`error`** — the fit is wrong. A module in a mount that cannot take it. This is the
  user's problem, and you should say so.
- **`incomplete`** — the library could not finish the job, usually because a module is
  newer than the catalogue. This is *our* problem, and it should read differently in
  your UI: the build may be perfectly fine in game.

Because the codes are stable, you can branch on them rather than on message text.

## Strict about input, forgiving about spelling

Two rules that look like they conflict and do not:

- **Identifiers are matched case-insensitively, with surrounding whitespace ignored.** A
  symbol straight off a journal line works without normalising it, and slot keys match
  whether the producer wrote `FrameShiftDrive` or `frameshiftdrive`.
- **Structure is checked strictly.** A malformed entry is rejected rather than
  half-read, and `parseSlef` rejects the whole payload on any bad entry. Use
  `inspectSlef` when you would rather have the good entries plus indexed diagnostics.

## Data you can rely on not changing

Exported catalogues are deeply frozen, so nothing a consumer does can mutate the shared
singleton a later lookup sees. Units are stated on the exported types: resistances are
fractions, masses tonnes, power megawatts, distances light-years, shield strength
megajoules — unless a symbol's own name says otherwise.

## Next

- [Getting started](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Getting-started)
- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
