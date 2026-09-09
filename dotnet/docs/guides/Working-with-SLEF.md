---
title: Working with SLEF
---

[.NET](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet) / Working with SLEF

# Working with SLEF

SLEF — the Ship Loadout Export Format — is how Inara, EDSY, Coriolis and the rest pass
builds around. A SLEF payload is an array of entries, each a `Header` naming the producer
and a `Data` half that is a journal `Loadout` event.

## Reading one

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

IReadOnlyList<SlefEntry> entries = Slef.Parse(slefJson);
string hull = entries[0].Data.Ship;      // the hull symbol
string tool = entries[0].Header.AppName; // which tool wrote it
```

[Slef](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Slef) reads JSON text or a `JsonElement` you already parsed,
and it accepts three shapes in order of leniency: the standard array of envelopes, a
single envelope, and a bare journal `Loadout` event, which is given an empty header of its
own. A journal line pasted straight in is a valid input, not a special case.

To go from a payload to something you can ask questions of, hand it to
[ShipLoadout](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.ShipLoadout) instead:

```csharp
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.FromSlef(slefJson);      // first entry by default
ShipLoadout second = ShipLoadout.FromSlef(slefJson, 1);  // or pick one
```

## `Parse` or `Inspect`?

They differ in what a bad entry costs you.

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

// `mixed` holds some good entries and some malformed ones.
Slef.Parse(mixed); // throws FormatException — the whole payload is rejected

SlefInspection seen = Slef.Inspect(mixed);
IReadOnlyList<SlefEntry> read = seen.Entries;              // the entries that did parse
IReadOnlyList<SlefDiagnostic> rejected = seen.Diagnostics; // one per rejected entry
```

Use `Parse` when the payload is yours and a malformed entry is a bug you want to hear
about. Use `Inspect` when you are importing a file a user handed you and would rather show
them which of their five builds failed than reject all five. Each
[SlefDiagnostic](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.SlefDiagnostic) carries the entry's `Index`, a
[SlefDiagnosticCode](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Enumeration.SlefDiagnosticCode), the `Path` to the
offending field and the constraint it broke — branch on those rather than on the English
`Message`.

Inspection validates the SLEF structure, not catalogue support. A structurally valid entry
whose `Ship` is absent from the hull catalogue remains in `Entries`, but
`ShipLoadout.FromSlef` raises `FormatException` when that entry is selected. Catch it when
converting each inspected entry into a build.

**Neither survives input that is not JSON.** Both read the text with
`System.Text.Json` first, so a truncated or non-JSON file raises `JsonException` from both
— catch that separately.

```csharp
using System.Text.Json;
using EliteDangerousAlmanac.Ships;

try
{
    Slef.Inspect(bytes);
}
catch (JsonException)
{
    // not JSON at all
}
```

## Writing one back out

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

SlefExportOptions options = new(new SlefHeader("MyApp", "1.0.0"));

string text = build.ToSlefString(options);                // a file or the clipboard
IReadOnlyList<SlefEntry> entries = build.ToSlef(options);  // the object form
LoadoutEvent journal = build.ToLoadoutEvent();             // just the journal event
```

The header is required, and naming your own app in it is the point: a downstream reader
needs to know which tool produced the build. SLEF attribution belongs to the application
producing the export and not to this library, which is why a caller supplies it. If you
re-export a build you imported, say so — the SLEF specification expects the exporting
application to identify itself, and this repository's `data/ships/SOURCES.md` records the
same requirement for captures it redistributes.

Several builds travel together in one export. Wrap their events with `Slef.Wrap` rather
than exporting each build on its own. `SlefExportOptions.Indent` is zero by default, which
is compact; give it a number of spaces to write something a human will read.

## Credits: retail against what a capture paid

This is the part most consumers get wrong, so the library keeps the two apart.

Everything the library computes is **catalogue retail** — a property of the fit. What a
capture *states it paid* is provenance about that capture: it carries station discounts,
it can price only part of the build, and two producers do not even agree on whether
`HullValue` includes the hull's stock fittings.

```csharp
using EliteDangerousAlmanac.Ships;

// Retail: the bare hull's price plus every fitted module's catalogue price.
LoadoutEvent retail = build.ToLoadoutEvent();

// The capture's own figures, less what was narrowed.
LoadoutEvent captured = build.ToLoadoutEvent(
    new LoadoutExportOptions { Credits = LoadoutCredits.Source });
```

The captured figures live on a read-only record that no edit changes:

```csharp
using EliteDangerousAlmanac.Ships;

// SourcePurchase is null for a build you assembled yourself.
SourcePurchaseRecord paid = build.SourcePurchase!;

double? hull = paid.HullValue; // 37472252, as the capture stated it
double? drive = SourcePurchase.FindModuleValue(paid, "FrameShiftDrive")?.Value; // 4976355
SourceModuleValue? cockpit =
    SourcePurchase.FindModuleValue(paid, "ShipCockpit"); // null — unpriced is not "free"
```

Each captured figure stays pinned to the article it was paid for, so **losing an article
narrows the source export rather than staling it**. Swap or remove a module and it exports
unpriced, taking `ModulesValue` and `Rebuy` with it; engineer a module or fill an empty
mount and both still stand. `HullValue` always stands, because it names no mount to
narrow.

Import normalization narrows it the same way before you have edited anything, and on one
more ground than an edit: a module the catalogue cannot resolve, one a stocked mount cannot
hold, and a core internal the capture named *no* module for are all removed or stocked from
the hull defaults, which leaves that mount unpriced and drops the two totals. Filling an
empty mount yourself leaves them standing because you can see the change; this one you did
not make. Three stocked-from-absence articles are the exception and leave the totals alone:
a bulkhead and a cargo hatch, which cost nothing, and a planetary approach suite, which
costs too little to void a purchase record over — so a source total may understate the fit
by that much, and by no more. `build.ImportOutcomes` says which — see
[Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Reading-a-player-journal#when-the-game-hands-you-something-unknown).

One limit: what a capture never priced, it also never explains, so losing an unpriced
module, to a removal or a replacement, cannot be detected.
[LoadoutExportOptions](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.LoadoutExportOptions) records that and the
other boundary cases.

## Mount-key spelling survives a round trip

Frontier writes `FrameShiftDrive`; Inara writes `frameshiftdrive`, as the SLEF
specification's own example does. Both name the same mount, and lookups are
case-insensitive in both directions. What a build already carries is never rewritten, so
re-exporting an import returns the producer's own spelling untouched.

## A recipe stated without its modifiers is rolled

A journal writes the modifier block beside the recipe. SLEF permits stating the recipe
alone — `BlueprintName`, `Level` and `Quality`, no `Modifiers` — and Inara writes it that
way for every engineered module. A parser that demands the list cannot read the format it
implements, so import rolls that recipe at the grade and quality the block states, and the
module publishes the figures the commander built rather than the ones it was sold with.

Two rules settle what a bare identity names, because a module's fixed articles can carry
the same blueprint at the same grade as one of its craftable recipes:

- **The module's engineering menu offers the recipe** — the block is an ordinary roll of
  it. That is what nearly every such block is, and a fixed article of the same module
  carrying that blueprint does not change the reading. It does make the reading a choice,
  though, so `ImportOutcomes` carries an
  [EngineeringAmbiguous](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.EngineeringAmbiguous) for that mount with
  the article it passed over in `PreEngineeredVariant`. Hand that straight to
  `ShipLoadout.SetPreEngineeredVariant` to take the other reading.
- **The menu does not offer it** — no ordinary roll could have written the block, so a
  single catalogued article answering to the stated blueprint, grade and effect is fitted
  and its fixed stats stand.

Where neither answers, the module keeps unengineered figures and says so: `ImportOutcomes`
carries an [EngineeringUnresolved](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.EngineeringUnresolved) naming the
mount, the module and the recipe.

A block that *does* state `Modifiers` is the source's own account of the module and is kept
verbatim — its figures are what the game reported, and outrank anything the library would
recompute. The exception is a block that moves nothing: every label naming a stat the
module has no value for, or no labels at all. Such a block describes some other module, so
the recipe stated beside it is rolled in its place and `ImportOutcomes` reports the mount
with an [EngineeringRerolled](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.EngineeringRerolled).

```csharp
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.FromLoadout(new LoadoutEvent(
    "Anaconda",
    new[]
    {
        new LoadoutModule("TinyHardpoint4", "hpt_heatsinklauncher_turret_tiny")
        {
            Engineering = new ModuleEngineering("misc_heatsinkcapacity", 1, 1),
        },
    }));

double? reload = build.FittedModuleAt("TinyHardpoint4")
    ?.EffectiveStats?.Stats[ModuleStat.ReloadTime]; // 15
```

## Next

- [Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Building-an-outfitting-screen)
- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Reading-a-player-journal)
- [API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.API)
