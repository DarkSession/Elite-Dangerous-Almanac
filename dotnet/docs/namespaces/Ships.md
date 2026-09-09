Hulls, outfitting modules, builds and every figure a shipyard screen shows.

**Start with
[ShipLoadout](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.ShipLoadout)**
— a build you can start empty, start from the hull's factory fit, read out of a journal
`Loadout` event or read out of a SLEF export, then edit slot by slot. Hand one to
[BuildMetrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.BuildMetrics)
for the numbers: jump range, power, shields, armour, weapons, ammunition, heat, mobility
and the power distributor.

The catalogues behind a build are
[ShipCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.ShipCatalogue)
for hulls,
[ModuleCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.ModuleCatalogue)
for outfitting, and
[BlueprintCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.BlueprintCatalogue)
with
[ExperimentalEffectCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.ExperimentalEffectCatalogue)
for engineering.
[Slef](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Slef)
reads and writes the Ship Loadout Export Format that Inara, EDSY and Coriolis pass builds
around in.

**A metric that needs a part the build does not carry says so rather than guessing.** The
`BuildMetrics` methods whose names end in `Result` answer a
[CalculationResult&lt;T&gt;](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.CalculationResult-1),
which carries either the figure or the inputs that stopped it. The
[failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model)
guide covers when you get which.
