---
title: Working with SLEF
---

# Working with SLEF

SLEF — the Ship Loadout Export Format — is how Inara, EDSY, Coriolis and the rest pass
builds around. A SLEF payload is an array of entries, each a `header` naming the
producer and a `data` half that is a journal `Loadout` event.

## Reading one

```ts
import { parseSlef } from '@elite-dangerous-almanac/core/ships/slef';

declare const slefJsonString: string;

const [entry] = parseSlef(slefJsonString);
entry?.data.Ship; // the hull symbol
entry?.header.appName; // which tool wrote it
```

`parseSlef` accepts a JSON string or an already-parsed value, and it also accepts a bare
`Loadout` event — a journal line pasted straight in is a valid input, not a special case.

To go from a payload to something you can ask questions of, hand it to
{@link ships!ShipLoadout | ShipLoadout} instead:

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const slefJsonString: string;

const build = ShipLoadout.fromSlef(slefJsonString); // first entry by default
const second = ShipLoadout.fromSlef(slefJsonString, 1); // or pick one
```

## `parseSlef` or `inspectSlef`?

They differ in what a bad entry costs you.

```ts
import { inspectSlef, parseSlef } from '@elite-dangerous-almanac/core/ships/slef';

declare const mixed: string; // some entries good, some malformed

parseSlef(mixed); // throws TypeError — the whole payload is rejected
const seen = inspectSlef(mixed);
seen.entries; // the entries that did parse
seen.diagnostics; // one per rejected entry, with its index and a stable code
```

Use `parseSlef` when the payload is yours and a malformed entry is a bug you want to
hear about. Use `inspectSlef` when you are importing a file a user handed you and would
rather show them which of their five builds failed than reject all five.

Inspection validates the SLEF structure, not catalogue support. A structurally valid
entry whose `Ship` is absent from the hull catalogue remains in `entries`, but
`ShipLoadout.fromSlef` rejects it when selected. Catch that `TypeError` when converting
each inspected entry into a build.

**Neither survives input that is not JSON.** Both call `JSON.parse` on a string first,
so a truncated or non-JSON file throws `SyntaxError` from both — catch that separately.

```ts
import { inspectSlef } from '@elite-dangerous-almanac/core/ships/slef';

declare const bytes: string;

try {
    inspectSlef(bytes);
} catch (error) {
    if (error instanceof SyntaxError) {
        // not JSON at all
    }
}
```

## Writing one back out

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

build.toSlefString({ header: { appName: 'MyApp', appVersion: '1.0.0' } });
build.toSlef({ header: { appName: 'MyApp', appVersion: '1.0.0' } }); // the object form
build.toLoadoutEvent(); // just the journal event
```

The header is required, and naming your own app in it is the point: a downstream reader
needs to know which tool produced the build. If you re-export a build you imported, say
so — the SLEF specification expects the exporting application to identify itself, and
this repository's `data/ships/SOURCES.md` records the same requirement for captures it
redistributes.

## Credits: retail against what a capture paid

This is the part most consumers get wrong, so the library keeps the two apart.

Everything the library computes is **catalogue retail** — a property of the fit. What a
capture *states it paid* is provenance about that capture: it carries station discounts,
it can price only part of the build, and two producers do not even agree on whether
`HullValue` includes the hull's stock fittings.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

build.toLoadoutEvent(); // retail: hull cost plus every module's list price
build.toLoadoutEvent({ credits: 'source' }); // the capture's figures, less what was narrowed
```

The captured figures live on a read-only record that no edit changes:

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
import { getSourceModuleValue } from '@elite-dangerous-almanac/core/ships/source-purchase';

declare const build: ShipLoadout;

const paid = build.sourcePurchase; // null for a build you assembled yourself
paid?.hullValue; // -> 37472252   as the capture stated it
paid && getSourceModuleValue(paid, 'FrameShiftDrive')?.value; // -> 4976355
paid && getSourceModuleValue(paid, 'ShipCockpit'); // -> null — unpriced is not "free"
```

Each captured figure stays pinned to the article it was paid for, so **losing an article
narrows the source export rather than staling it**. Swap or remove a module and it
exports unpriced, taking `ModulesValue` and `Rebuy` with it; engineer a module or fill an
empty mount and both still stand. `HullValue` always stands, because it names no slot to
narrow.

Import normalization narrows it the same way, before you have edited anything: a module
the catalogue cannot resolve is discarded or replaced with the hull's stock article, so
its slot exports unpriced and the two totals go with it. `build.importOutcomes` says
which — see
[Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal#when-the-game-hands-you-something-unknown).
The built-in cargo hatch is the exception, being unpurchasable: an unpriced or
zero-priced captured hatch leaves the totals standing.

One limit worth knowing: what a capture never priced, it also never explains — so
removing an unpriced module cannot be detected. `LoadoutExportOptions.credits` records
that and the other boundary cases.

## Slot-key spelling survives a round trip

Frontier writes `FrameShiftDrive`; Inara writes `frameshiftdrive`, as the SLEF
specification's own example does. Both name the same mount, and lookups are
case-insensitive in both directions. What a build already carries is never rewritten, so
re-exporting an import returns the producer's own spelling untouched.

## Next

- [Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Building-an-outfitting-screen)
- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
