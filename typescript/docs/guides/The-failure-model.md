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

**Two of those rows need qualifying on the SLEF entry points that accept a string** —
`parseSlef`, `inspectSlef` and `ShipLoadout.fromSlef`. All three throw `SyntaxError`,
which comes from `JSON.parse` before any validation runs. Past that point a payload
number outside its documented journal range — a module `Priority` of 5, a `Health` of
`-0.1` — counts as malformed alongside every other bad field rather than as a range
violation: `parseSlef` and `ShipLoadout.fromSlef` throw `TypeError` naming the field, and
`inspectSlef` records it as that entry's diagnostic.

**A wrong-typed argument is malformed input**, not a miss. Passing a number where a
symbol belongs is the same kind of failure as passing an unusable address, and an entry
point that guards it names the parameter and what arrived —
`ShipLoadout.empty(42)` throws `TypeError: ShipLoadout.empty: shipSymbol must be a
string, received number 42`. So does a missing one: `ProceduralSystem.fromName(undefined)`
throws rather than answering `null`, because "you passed me nothing" is not "the naming
scheme does not cover that system". Three entry points enforce this today —
`ProceduralSystem.fromName`, `ShipLoadout.empty`, and the module argument of
`ShipLoadout.setModule`. Everywhere else the class is still `TypeError`, but the message
is the internal property access that failed rather than one naming your value; see
[issue 201](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/201) for which
entry points those are.

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

**A figure the import already stated wins, and comes back complete.** These three are
computed only when the source did not supply them, so a build read from a `Loadout` event
— which states `UnladenMass`, `CargoCapacity` and `FuelCapacity` — reports the game's own
numbers with no issues, whatever the catalogue made of the modules. The pair engages for a
build you assembled yourself, or one whose source left the figure out. On an imported
build, `validation` is what tells you a module went unrecognised.

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

- **`error`** — the fit is wrong: a module in a mount that cannot take it
  (`incompatibleModule`), or a mount the hull does not have (`unknownSlot`). This is the
  user's problem, and you should say so. (`duplicateSlot` is an error too, but only ever
  reaches you from `validateLoadout` on a module list you assembled yourself — a
  `ShipLoadout` throws `TypeError` on a duplicate rather than reporting one, so do not
  write a UI branch for it on a build.)
- **`incomplete`** — the build does not add up to a finished answer, for one of two
  quite different reasons.

**Branch on the code, not on the severity**, because the two `incomplete` reasons belong
in different places in your UI:

- `missingRequiredSlot` is the **user's** problem — a core or armour mount is empty. A
  hull straight from `ShipLoadout.empty()` reports eight of these, and "you have not
  fitted a power plant" is exactly what an outfitting screen must show as actionable.
- `unknownHull` and `unknownModule` are **ours** — the catalogue is behind the game.
  This should read differently: the build may be flying perfectly well, and a consumer
  that presents it as a mistake will be wrong on every game update.

That is why the codes are stable: the severity alone does not tell you whose problem an
issue is.

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
