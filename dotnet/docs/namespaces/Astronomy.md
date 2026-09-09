Astrophysical data and calculations for the Elite Dangerous galaxy.

**Start with
[ProceduralSystem](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.ProceduralSystem)**
— it composes the pieces below into one immutable value: a name and its system address
either way round, the sector, the mass code and the regions the game names by hand. Reach
for an individual calculation when you want just one.

**A note on the word "region".** It means four different things here, and the types are
kept apart so they cannot be confused:

- *procedural sector* —
  [SectorName](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.SectorName),
  the boxel grid's own name for a cube of space.
- *naming-region origin* —
  [NamingRegionOrigins](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.NamingRegionOrigins),
  a sector's corner, which is what a system address is measured from.
- *hand-authored region* —
  [HandAuthoredRegions](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.HandAuthoredRegions)
  — the Pleiades, the Coalsack and the rest, whose names the game writes over the
  generator's.
- *galactic codex region* —
  [CodexRegionMap](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.CodexRegionMap),
  one of the 42 zones the codex counts. Its map geometry is large, so it is a lookup of
  its own and a caller that wants a name never loads it.

None of those is the **nebula catalogue** — the nebulae themselves, and where they are:
[NebulaCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.NebulaCatalogue).

**Bodies arrive as the journal writes them.**
[BodyScanEvent](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Record.BodyScanEvent)
is the game's `Scan` line, and
[BodyPhysics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.BodyPhysics),
[BodyOrbit](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.BodyOrbit),
[BodyRings](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.BodyRings)
and
[StarPhysics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Class.StarPhysics)
read one. A scan states one line of figures, so a calculation over a field the scan did not
write answers `null` rather than guessing.
