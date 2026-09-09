---
title: Systems and regions
---

[.NET](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet) / Systems and regions

# Systems and regions

Elite Dangerous uses the word "region" for four different things, and uses two
three-number coordinate shapes that are easy to confuse. This guide separates them, and
covers the `id64` round trip that most tools need first.

## Names and addresses

[ProceduralSystem](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.ProceduralSystem) is the handle that ties a
procedural name to its `id64` and back.

```csharp
using EliteDangerousAlmanac.Astronomy;

ProceduralSystem system = ProceduralSystem.FromName("Synuefe EN-H d11-96")!;
ulong address = system.SystemAddress;    // 3309179996515
string region = system.NamingRegionName; // "Synuefe"
char code = system.MassCode;             // 'd'

string name = ProceduralSystem.FromSystemAddress(address).Name; // "Synuefe EN-H d11-96"
```

**`FromName` answers `null` for a name that is not procedural.** Sol, Shinrarta Dezhra
and every other hand-named system fall outside this type by design, so `null` means "this
is hand-named", not "something went wrong". The two factories differ deliberately: a name
that does not parse is an ordinary answer, while an address whose grid slot has no
procedural name raises `ArgumentOutOfRangeException`.

An address is a `ulong`, which is the range the game's own `id64` occupies, so no address
needs a wider type or a conversion. A decimal string — a query parameter, a configuration
file, a column read as text — becomes one through
[SystemAddress](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.SystemAddress).

```csharp
using EliteDangerousAlmanac.Astronomy;

ulong address = SystemAddress.Parse("3309179996515");
SystemAddress.TryParse("not an address", out ulong _); // false, for input you do not control
```

To take an address apart without building a whole system:

```csharp
using EliteDangerousAlmanac.Astronomy;

DecodedSystemAddress decoded = SystemAddress.Decode(3309179996515);
int sizeClass = decoded.SizeClass;                    // 3
long sequence = decoded.Sequence;                     // 96
SectorGridPosition grid = decoded.SectorGridPosition; // (39, 31, 18)
```

## The two coordinate spaces

Both are three numbers. The type names are what stop you mixing them up.

- **[GalacticPosition](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Record.GalacticPosition)** is `X`, `Y`, `Z` in
  **light-years**, Sol at the origin. This is what the journal's `StarPos`, EDSM and
  Spansh give you.
- **[SectorGridPosition](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Record.SectorGridPosition)** is `SectorX`,
  `SectorY`, `SectorZ` — integer indices on the naming grid, whose cell edge is
  `GalaxyGrid.SectorEdgeLy`.

```csharp
using EliteDangerousAlmanac.Astronomy;

GalacticPosition position = new(-81.625, -151.3125, -376.0625); // light-years

SectorGridPosition grid = GalaxyGrid.ToSectorGridPosition(position); // (38, 31, 18)
string sector = SectorName.FromGridPosition(grid);                   // "Synuefai"
```

If you are starting from a real position and only want the name, go straight there with
`GalaxyGrid.ToSectorName` rather than converting by hand.

## The four meanings of "region"

Answered here for one position — the Pleiades. They disagree, which is the point: each
names a different thing.

```csharp
using EliteDangerousAlmanac.Astronomy;

GalacticPosition position = new(-81.625, -151.3125, -376.0625);

string sector = GalaxyGrid.ToSectorName(position);        // "Synuefai"         procedural sector
string? region = HandAuthoredRegions.FindAt(position)?.Name; // "Pleiades Sector"  hand-authored
string? codex = CodexRegionMap.FindAt(position)?.Name;    // "Inner Orion Spur" codex region
double? corner = NamingRegionOrigins.Resolve("Synuefai")?.X; // 1556480         naming-region origin
```

| Concept | What it is | Entry point |
| --- | --- | --- |
| Procedural sector | The boxel-grid name a system inherits | `GalaxyGrid.ToSectorName`, `SectorName.FromGridPosition` |
| Naming-region origin | A sector's corner, used to encode `id64` | `NamingRegionOrigins.Resolve` |
| Hand-authored region | Pleiades, Coalsack, … — named by Frontier | `HandAuthoredRegions.FindAt` |
| Codex region | One of the galactic codex zones, numbered 1 to 42 | `CodexRegionMap.FindAt`, `CodexRegionMap.FindForBoxel` |

`CodexRegionMap.FindAt` reads only the X and Z axes, because the codex map is an X/Z
projection. Its overload taking a `GalacticPosition` accepts one as it comes and ignores
the `Y`; the overload taking a
[GalacticPlanePosition](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Record.GalacticPlanePosition) says the same
thing in the type.

A system inside a hand-authored region takes that region's name instead of the procedural
sector's — `ProceduralSystem.UsesHandAuthoredRegion` tells you which happened. That is
also why `FromSystemAddress` takes an optional position: an address states the boxel and
not the place, so without a position such a system quietly carries its procedural name.

## Nebulae are none of those

The nebula catalogue answers "what is near here", not "what is this called".

```csharp
using EliteDangerousAlmanac.Astronomy;

GalacticPosition position = new(-81.625, -151.3125, -376.0625);

foreach (NebulaNearby near in NebulaCatalogue.Nearest(position, NebulaCatalogue.Real, 2))
{
    // near.Name is "Pleiades", then "Taurus Dark Region";
    // near.DistanceLy is how far it is from the position.
}

int within100Ly = NebulaCatalogue.Within(position, NebulaCatalogue.Real, 100).Count;
```

**The catalogue argument is required, not defaulted.** Nearly all of
`NebulaCatalogue.All` is planetary nebulae that most callers never touch, so there is no
one catalogue worth reading without being asked to. `NebulaCatalogue.Real` is the small,
human-recognisable slice, and it is the one most callers want.

## Permit locks

Two kinds, one lookup, from a name alone.

```csharp
using EliteDangerousAlmanac.Astronomy;

PermitLockKind? sol = PermitLocks.ForSystemName("Sol")?.Kind;  // System, individually locked
PermitLockKind? col =
    PermitLocks.ForSystemName("Col 70 Sector AB-C d1-23")?.Kind; // Region, the region is locked
PermitLock? open = PermitLocks.ForSystemName("Synuefe EN-H d11-96"); // null, not locked
```

There are narrower lookups beneath it — by address, by region name, and the boolean forms
— but start here: it is the only one that answers for both kinds without you knowing in
advance which applies. A system that carries a lock of its own and also sits inside a
locked region answers with its own. `ProceduralSystem.RequiresRegionPermit` is a
region-level flag only; individually locked systems are hand-named and so never reach a
`ProceduralSystem` at all.

## Next

- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Reading-a-player-journal)
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model)
- [API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.API)
