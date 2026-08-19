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
scheme does not cover that system".

Human-readable errors and validation messages abbreviate an oversized argument or
capture field with an ellipsis. They identify the bad value without copying a whole
payload into a log or UI; structured diagnostic fields such as `slot` and `symbol` keep
the original value for programmatic handling.

Which half of your call the message names depends on what you handed over, and that is
worth knowing before you write a `catch`:

- **An entry point that takes a value names the parameter and the value**, and names
  _itself_ — a lookup you reach through a facade reports the function you called, not the
  one it delegates to, so `getShipSlots(42)` says `getShipSlots: symbol`, never
  `getShipBySymbol: symbol`. `toSystemAddress` prints the value it rejected without a
  parameter to name, having only the one.
- **An entry point that takes a structure names the offending field.** `parseSlef` and
  `ShipLoadout.fromSlef` check every one of them
  (`parseSlef: entries[0].data.Modules[0].Priority must be an integer from 0 to 4`) — the
  more useful half when the argument is a whole export, and the same text `inspectSlef`
  reports as that entry's diagnostic. `ShipLoadout.fromLoadout` checks the structure a
  build is assembled from — an object, an array of module objects, a `Slot` and `Item` on
  each, no two modules claiming one slot, and an `Engineering` that is an object holding
  an array of `Modifiers`, each a labelled object, whenever their key is there at all —
  plus a required `Ship` that names a known hull, and the block's two ids when they carry
  a value. It trusts the remaining numeric and boolean values, so use `fromSlef` for an
  event you did not produce yourself.

**A missing argument is not a wrong-typed one**, and the two get different answers:

```ts
import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';

getShipBySymbol(undefined as unknown as string); // -> null, the answer an unknown symbol gets

try {
    getShipBySymbol(42 as unknown as string);
} catch (error) {
    (error as Error).message;
    // -> 'getShipBySymbol: symbol must be a string, received number 42'
}
```

A lookup that answers `null` for a symbol no record carries answers `null` for no symbol
at all — asking for nothing found nothing. So do `parseSystemName`,
`canonicalizeSystemName` and `isProceduralSystemName`, which answer `null` and `false`
for a nullish name.

**Where a missing argument is loud instead: everything that is not a search.** A function
that hands you back a value has no "no such thing" answer to give, so there is nothing for
a missing argument to mean — `ProceduralSystem.fromName(undefined)` and
`ShipLoadout.empty(undefined)` throw rather than answering `null`, and so do
`toSystemAddress`, `massCodeToSizeClass` and `resolveBlueprintForModule`'s `fdname`,
which convert or resolve what you pass rather than looking it up. The rule is what the
function does with the argument, not what it returns: `massCodeToSizeClass` hands back a
number and is still strict.

**A build's slot key is loud too**, across all ten methods that take one, and it is the
exception worth knowing because several of them do look like searches —
`fittedModuleAt('NoSuchMount')` answers `null` the way a catalogue miss does. The
difference is that the key names a mount on *this* build rather than a record to find:
`removeModule(undefined)` is not "empty the slot that is not there", it is a caller who
has not said which slot. So `build.fittedModuleAt(undefined)` throws
`ShipLoadout: slotKey must be a string, received undefined`, where
`getShipBySymbol(undefined)` would answer `null`.

**`null` is not an error.** A lookup that finds nothing has answered you. Journal symbols
may be absent from the catalogues, so consumers must handle `null` as an ordinary miss.

For input you do not control, prefer the `try…` form where one exists, which converts a
throw into a `null`:

```ts
import { toSystemAddress, tryToSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address-input';

toSystemAddress('3309179996515'); // -> 3309179996515n, throws on bad input
tryToSystemAddress('not an address'); // -> null, never throws
```

## Nullable value, or diagnostic result?

The following catalogue-dependent build figures expose diagnostic pairs. The nullable
property or method is the convenience; its `…Result` companion is what you show a user
when the convenience is `null`.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

build.cargoCapacity; // number | null
build.cargoCapacityResult; // the value, plus every rack it could not classify

build.unladenMass;
build.unladenMassResult;
build.fuelCapacity;
build.fuelCapacityResult;

build.mobilityMetrics();
build.mobilityMetricsResult();
build.shieldMetrics();
build.shieldMetricsResult();
build.shieldRecovery();
build.shieldRecoveryResult();
```

Each result is a `CalculationResult`: `complete: true` carries a non-null `value` and no
issues; `complete: false` carries `value: null` and one or more issues. The issue's stable
`reason` says which unavailable state the caller should present:

| Reason | Means |
| --- | --- |
| `missing` | A required module is not fitted |
| `unresolved` | The catalogue or supplied record lacks a required module or numeric fact |
| `disabled` | The required fitted module is switched off |
| `shed` | The retracted priority budget does not power the required module |
| `invalid` | A known build dependency is non-physical, such as a non-positive or non-finite power-plant capacity or a negative module draw |

These reasons describe build state. A malformed method option still throws its documented
`TypeError` or `RangeError` before a result is returned.

The reason for the pair is that the alternative is worse: an unclassifiable cargo rack
counted as zero, or shed thrusters treated as powered, would produce a plausible wrong
answer that no one would question. A `null` with the reason it is unavailable cannot be
mistaken for an answer.

**A figure the import already stated wins while its fitted set remains intact.** A build
read from a `Loadout` event reports the game's `UnladenMass`, `CargoCapacity` and
`FuelCapacity` directly. If import strips an unrecognised module or stocks a fixed mount,
it drops the capture's aggregates too: mass, cargo and fuel are recomputed from the
normalized fit, while `modulesValue` and `rebuy` read `null`, because nothing records
what the discarded article cost. Restoring an absent cargo hatch changes none of them —
the stock hatch is free and weightless.

**Absent is not zero, anywhere in the library.** A catalogue field the source did not
carry is omitted rather than defaulted, and a capture that priced no module for a slot
reports `null` rather than `0` — a cockpit no journal prices was not free.

## `valid` against `complete`

Two different questions about a build, deliberately kept apart:

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

build.validation.valid; // is the fit structurally legal?
build.validation.complete; // every operational mount present?
build.validation.issues; // what specifically
```

Each issue carries a stable `code` and a `severity`:

- **`error`** — the fit is wrong: a module in a mount that cannot take it
  (`incompatibleModule`), or a mount the hull does not have (`unknownSlot`). This is the
  user's problem, and you should say so. (`duplicateSlot` is an error too, but only ever
  reaches you from `validateLoadout` on a module list you assembled yourself — a
  `ShipLoadout` throws `TypeError` on a duplicate rather than reporting one, so do not
  write a UI branch for it on a build.)
- **`incomplete`** — the build does not add up to a finished answer.

`missingRequiredSlot` is the incomplete case: a core or armour mount is empty. A hull
straight from `ShipLoadout.empty()` reports eight of these, and "you have not fitted a
power plant" is exactly what an outfitting screen must show as actionable. Unknown
module symbols do not reach validation: imports discard them from removable mounts and
stock unknown armour, core internals and the cargo hatch from the hull defaults. A mount
the source named no module for is left as it found it — the cargo hatch excepted, which
is part of the hull and is restored from the same defaults — and a required one reaches
validation as `missingRequiredSlot`, as does an unknown fixed mount whose hull has no
default.

**Neither question reports normalization.** A build whose unknown power plant was stocked
from the hull defaults is `valid` and `complete` with no issues — the fit that remains
really is legal and really is filled. `build.importOutcomes` is the only record that the
figures now describe that fit rather than the capture.

## Strict about input, forgiving about spelling

Two rules that look like they conflict and do not:

- **Identifiers are matched case-insensitively, with surrounding whitespace ignored.** A
  symbol straight off a journal line works without normalizing it, and slot keys match
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
