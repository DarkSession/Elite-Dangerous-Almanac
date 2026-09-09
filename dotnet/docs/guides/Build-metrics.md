---
title: Build metrics
---

[.NET](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet) / Build metrics

# Build metrics

How this library arrives at the numbers an outfitting screen shows — power, shields,
armour, resistances, weapon output, ammunition, heat and jump range. Each metric has its
own page in the API reference; this is the argument that runs through all of them, which
no single symbol owns.

## Two layers, and which one you want

Every metric exists twice, and the difference is where the numbers come from rather than
what the maths does.

The **calculation classes** — [Power](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Power),
[Shields](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Shields), [Armour](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Armour),
[Resistances](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Resistances),
[Weapons](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Weapons),
[Ammunition](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Ammunition), [Heat](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Heat),
[JumpRange](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.JumpRange) and
[Mobility](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Mobility) — are data-free. You hand them the constants
and they hand back a figure, reading no catalogue at all, so they are the right layer for
a what-if tool that is not modelling a real build.

```csharp
using EliteDangerousAlmanac.Ships;

double deployed = Power.Budget(20.4, new[]
{
    new PowerConsumer(0.45) { Priority = 1 },                      // life support
    new PowerConsumer(5.72) { Priority = 1 },                      // thrusters
    new PowerConsumer(2.48) { Priority = 3, DeployedOnly = true }, // a beam laser
}).Deployed; // 8.65
```

The [BuildMetrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.BuildMetrics) methods of the same name gather
those constants out of a real build — the fitted modules, the hull, and whatever
engineering each module carries — and call the function for you. This is what an
outfitting screen wants. Attach one to a
[ShipLoadout](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.ShipLoadout) with `BuildMetrics.Of(build)`.

```csharp
using EliteDangerousAlmanac.Ships;

// `metrics` is BuildMetrics.Of(build) for a Federal Corvette.
double deployed = metrics.PowerBudget().Deployed;             // 46.8597
double armour = metrics.ArmourMetrics().HitPoints;            // 5062.6
double guns = metrics.WeaponMetrics().Total.DamagePerSecond;  // 137.04

if (metrics.ShieldMetricsResult().TryGetValue(out ShieldMetrics shields))
{
    double strength = shields.Strength; // 3940.4
}
```

The rest of this page is about the second layer, because the first is documented where it
lives: each function's own page states its formula, its units and its reference
implementation.

## Engineering happens first

Every `BuildMetrics` figure reads **post-engineering** stats. A build's modifiers are
folded onto the module's catalogue values before any metric sees them, so there is no step
where a caller applies engineering themselves — and no way to ask for the stock figure
through these methods.

Two consequences follow.

**A journal's own modifiers are never recomputed.** When a build comes from `FromLoadout`
or `FromSlef`, the modifier block the game wrote is taken as stated. That is deliberate:
the game is the authority on a build it exported, and a recomputation that disagreed would
silently replace a fact with a model. The library recomputes only what it rolled itself,
through `ShipLoadout.ApplyBlueprint` — which includes a block that states a recipe and
*no* modifiers, since there is then no fact to replace. See
[Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Working-with-SLEF#a-recipe-stated-without-its-modifiers-is-rolled)
for what such a block resolves to.

**Four stats are percentages of a multiplier, not of the stat.** Hull boost, shield boost
and the four damage resistances compound on `1 + v` and `1 − v` respectively, whichever
apply method the recipe names. A `+80%` bulkhead engineered by a `+32%` blueprint reads
`137.6%`, not `105.6%`, because `1.8 × 1.32 − 1 = 1.376`; a `−20%` kinetic resistance with
`+5%` becomes `−14%`, because the multipliers `1.2 × 0.95` multiply. This is Frontier's own
convention and it is why those four stats look wrong if you read them as ordinary
percentages. [Engineering](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Engineering) states the rule; every metric
below inherits it.

## Power

The plant's capacity against what the build draws, split two ways because weapons and most
utility fittings only draw while the hardpoints are **deployed**.

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

PowerBudget power = metrics.PowerBudget();

double available = power.Available;  // MW the plant makes
double retracted = power.Retracted;  // MW drawn with hardpoints in
double deployed = power.Deployed;    // MW drawn with hardpoints out
bool fits = power.WithinBudget;      // does it fit?
IReadOnlyList<PowerBand> bands = power.Bands;               // the five priority groups
IReadOnlyList<PowerConsumerResult> draws = power.Consumers; // positive draws, in source order
```

`Bands` is what drives a priority-group table. A group is powered when its **running
total** — its own draw plus every higher-priority group's — fits in `Available`; the game
shuts off the first group that would go over and everything below it, rather than the
individual module that broke the budget.

`Consumers` keeps every positive power draw in source order and normalises the fields the
budget uses; passive and zero-draw fittings are absent.

## Shields and armour share a resistance model

Strength and hit points are separate calculations, but the four resistances that decide
what they are worth stack by one shared rule, in
[Resistances](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Resistances).

Sources stack **multiplicatively on the damage multiplier**, not additively on the
resistance: two 20% resisters leave `0.8 × 0.8 = 0.64`, which is 36% resisted, not 40%.
The game then bends the result so stacking cannot run away — past a threshold, the
remaining gain is halved. The threshold differs between shields and hull, and both are
stated on `StackShieldResistance` and `StackArmourResistance`.

```csharp
using EliteDangerousAlmanac.Ships;

// A stock generator at 40% kinetic, under four 20% resistance-augmented boosters.
double kinetic = Resistances.StackShieldResistance(0.4, new[] { 0.2, 0.2, 0.2, 0.2 });
// 0.667…, not 0.4 + 4 × 0.2
```

What a resistance is worth is the **effective hit points** it buys — the pool divided by
what still gets through. Both metrics report that per damage type, and
`Resistances.EffectiveHitPoints` is the same function they use, so a pool of your own
converts the same way:

```csharp
using EliteDangerousAlmanac.Ships;

// 945 hull points behind lightweight alloy, which is weak to kinetic (-20%) and
// explosive (-40%) damage alike.
DamageTypeValues resistances = new(Kinetic: -0.2, Thermal: 0, Explosive: -0.4, Caustic: 0);
double pool = Resistances.EffectiveHitPoints(945, resistances).Kinetic;
// 787.5, fewer than the hull holds
```

Two things about shields catch people out. A generator's strength multiplier is read off a
curve against the **bare hull mass**, not the loaded ship — so fitting more modules never
weakens your shields. And past the generator's maximum mass it will not raise a shield at
all, which the curve reports as `0` rather than as a small number.

`ShieldMetricsResult` evaluates the generator, boosters and reinforcement against the
hardpoints-stowed (retracted) budget. It is incomplete when no generator is powered in
that state, and its issues distinguish a missing, switched-off or shed generator from an
unavailable power supply. Every imported build has a known hull and armour.
`MobilityMetricsResult` and `ShieldRecoveryResult` use the same retracted power state for
their thrusters, generator and distributor, and explain an unavailable answer in the same
way.

**The pips are a separate call.** `ShieldMetricsResult` is the bare shield an outfitting
screen shows, and the SYS capacitor is `ShieldCapacitorMetricsResult` — the same split
`WeaponMetrics` and `WeaponsCapacitorMetrics` use for WEP. It reports the SYS capacity and
recharge the allocation buys, the resistance the pips add on their own, and the effective
resistances and hit points with them folded in, so a panel showing both readings computes
the shield once:

```csharp
using EliteDangerousAlmanac.Ships;

BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));

// The generator and boosters alone.
metrics.ShieldMetricsResult().TryGetValue(out ShieldMetrics bare);
double bareKinetic = bare.Resistances.Kinetic;

if (metrics.ShieldCapacitorMetricsResult(systemsPips: 2).TryGetValue(
        out ShieldCapacitorMetrics sys))
{
    double pips = sys.SystemsResistance;            // what two pips add, on their own
    double both = sys.EffectiveResistances.Kinetic; // the two, multiplied together
    double soaked = sys.EffectiveHitPoints.Kinetic; // MJ of kinetic damage at two pips
    double recharge = sys.RechargeRate;             // MJ/s into the SYS capacitor
}
```

The pips multiply with the shield's own stack rather than adding to it, which is why the
capacitor owns the arithmetic: `1 − (1 − shieldResistance) × (1 − systemsResistance)`. At
zero pips the effective figures are the bare ones, exactly.

`ShieldRecoveryResult` keeps its own pip allocation. Every figure it contains is a
function of the allocation — there is no unpiped recovery time to report — so nothing
there is being folded into a base figure and then discarded. Its recharge is the
`RechargeRate` in `ShieldCapacitorMetricsResult` at the same allocation.

## Weapon output

`WeaponMetrics` reports per-weapon figures and a total. The distinction that matters is
**damage per second** against **sustained** damage per second: the first is the rate while
firing, the second folds in the clip and the reload, because a weapon that stops to reload
is not firing.

```csharp
using EliteDangerousAlmanac.Ships;

BuildWeaponMetrics weapons = metrics.WeaponMetrics();

double firing = weapons.Total.DamagePerSecond;             // while firing
double sustained = weapons.Total.SustainedDamagePerSecond; // with reloads
double energy = weapons.Total.EnergyPerSecond;             // capacitor draw, MW
double heat = weapons.Total.HeatPerSecond;
int fitted = weapons.Weapons.Count;                        // per-hardpoint breakdown

if (metrics.DistributorMetricsResult(new DistributorPips(2, 2, 2))
        .TryGetValue(out DistributorMetrics distributor))
{
    double rated = distributor.Engines.RatedRecharge; // four-pip catalogue rate, MJ/s
    double actual = distributor.Engines.RechargeRate; // ENG recharge at two pips, MJ/s
}

WeaponsCapacitorMetrics capacitor = metrics.WeaponsCapacitorMetrics(weaponsPips: 2);

double recharge = capacitor.RechargeRate; // actual WEP recharge at two pips, MJ/s
double drain = capacitor.NetDrainRate;    // sustained draw minus recharge, floored at zero
double endurance = capacitor.TimeToDrain; // seconds from full, or infinity if recharge keeps pace
```

Beam and mining lasers are **continuous**: they carry no rate of fire, and their damage,
distributor draw and thermal load are already per second, so the per-shot arithmetic
collapses to the raw stats.

A distributor's three catalogue recharge figures are their four-pip maxima.
`DistributorMetricsResult` scales SYS, ENG and WEP independently by `(pips / 4) ^ 1.1` and
answers each capacity, rated recharge and actual rate. Fractional allocations from zero
through four are accepted; each defaults to four independently and they need not total
six, so the result can compare three independent scenarios. It is incomplete when the
distributor is missing, switched off or shed, or when the fitted article's capacitor stats
cannot be resolved; the issue's `Reason` says which.

`WeaponsCapacitorMetrics` adds firing endurance to the WEP calculation. It compares
pip-scaled recharge with **sustained** energy per second: a magazine's reload is time for
the capacitor to recover, so burst draw would understate endurance.

The general distributor facade applies the **retracted** power budget: all three
capacitors recharge while hardpoints are stowed. Weapons endurance instead applies the
**deployed** budget, because its result models firing. A distributor or weapon shed in the
relevant state contributes nothing.

One asymmetry is deliberate. Frontier's Rapid Fire and High Capacity recipes shorten the
**fire interval** rather than raising the rate of fire, so that is the label those
blueprints carry; a weapon's combined rate of fire follows from the interval and the burst
pattern. `ShipLoadout` recomputes it for you, so you only meet this if you call
`Engineering.ComputeModifiers` directly.

## Ammunition, and why it rounds

`Ammunition.Capacity` reports what a module *can* hold when fully rearmed — the magazine,
the reserve behind it, and the two together. A journal's `AmmoInClip` and `AmmoInHopper`
report what is loaded at the moment of capture, which is a different question: a reading is
a **lower bound** on a capacity and never a reading of one, so the library never infers a
catalogue figure from a rearm state.

Three answers are distinct, and a consumer should not collapse them:

- a module with a magazine and a reserve reports both, and their sum;
- a module with a magazine but **no reserve figure** is reported as unlimited;
- a reserve of **zero** is a real answer, not an unlimited one — the Mk II Plasma Shock
  Accelerator has nothing behind its magazine.

Engineered ammunition is reported in whole rounds, because a ship cannot load a tenth of a
round and both stats are multiplicative under engineering. **A clip rounds up to a whole
burst; a reserve rounds to the nearest round.** The rounding runs after every blueprint and
experimental contribution has compounded, and it applies only to a value the library
computed — a clip a journal states passes through untouched, a recipe leg that *overwrites*
the clip is a published figure rather than a product of one, and a roll that leaves the
clip where it was leaves it there.

One more rounding rule exists because registries state a recipe's multiplier to three or
four decimals. A leg meant to add two thirds is written `0.667`, which computes 10.002
rounds on a 6-round rack — and left alone that thousandth becomes a whole extra round once
the clip rounds up, or a whole extra burst on a burst weapon. A clip within half a unit in
the multiplier's third decimal is therefore taken as the whole number it means. A quality
roll between two published legs gets no such treatment: it is a real number with no whole
magazine behind it.

## Heat

What the build runs at, and whether firing everything cooks it. Heat is the one metric
here that no stated Frontier figure underwrites: the game publishes no formula and shows
no dissipation figure, so the model — and the per-hull heat dissipation it reads — is
community measurement of the game, ported from EDSY and credited in `ATTRIBUTIONS.md`.

```csharp
using EliteDangerousAlmanac.Ships;

if (metrics.HeatMetricsResult().TryGetValue(out HeatMetrics heat))
{
    double idle = heat.Idle.Gauge;          // stowed, as the cockpit gauge reads it: 1 is 100%
    double spooling = heat.FsdCharging.Gauge; // the hottest thing most ships do
    bool cooks = heat.FiringSustained.Overheats; // trigger held, WEP capacitor keeping up
    double? alpha = heat.FiringDrained.SecondsToOverheat; // on an empty capacitor
}
```

Two numbers decide everything, and they are not interchangeable. **Dissipation** is a
ceiling: a build whose thermal load stays under the hull's heat dissipation settles below
heat level 1 and never overheats, however long it fires; one that goes over never settles
at all. **Capacity** is only inertia — it sets how long the climb takes, which is why a
build that cooks itself in eight seconds and one that cooks itself in two are the same
kind of broken.

Heat follows what the plant **actually feeds**. A module switched off makes no heat, and
neither does one in a priority group the plant cannot keep lit — including the thrusters
and the guns. That check is state-dependent, so a build whose thrusters survive with the
hardpoints stowed but get shed once they are out reports thruster heat in `Thrusters` and
none in the firing scenarios.

Each scenario is cumulative, and each reports both a settled level and a countdown:
`Gauge` is the level as a fraction of the in-game readout, `Overheats` says whether it
settles at all, and `SecondsToOverheat` fills in when it does not. A load beyond
dissipation reports an infinite level rather than a settling point it never reaches.

`FiringSustained` and `FiringDrained` differ only in the state of the weapons capacitor,
and the gap is large: a shot the capacitor cannot pay for makes **five times** its thermal
load. A build that never overheats in a duel can cook itself in a wing fight with the same
guns.

## Mass, and how the thrusters read it

Mass is the input half of the flight model, so the library publishes it rather than
leaving a screen to reassemble it. `BuildMass` is the mass counterpart of `BuildCost`, and
splits the same three ways:

```csharp
using EliteDangerousAlmanac.Ships;

BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));

BuildMass mass = metrics.BuildMass();

double hull = mass.Hull;       // 400   the bare hull, in tonnes
double modules = mass.Modules; // 664   every fitted module, post-engineering
double unladen = mass.Unladen; // 1064  what ShipLoadout.UnladenMass reports
double total = mass.Total;     // 1096  with the load below aboard
double fuel = mass.Fuel;       // 32    a full main tank by default
double cargo = mass.Cargo;     // 0     an empty hold by default

double loaded = metrics.BuildMass(new BuildLoad(Fuel: 8, Cargo: 32)).Total; // 1104
```

The fuel and cargo defaults are exactly those of `JumpRangeAt` and
`MobilityMetricsResult`, so the three agree by construction. Each of the standard loads
carries its own resulting mass too:

```csharp
using EliteDangerousAlmanac.Ships;

metrics.StandardLoadResult(StandardLoad.Laden).TryGetValue(out StandardLoadFigures laden);
double ladenMass = laden.Mass; // 1210
```

**The reserve tank is in none of these.** The game's statistics panel counts it in the
current mass it displays, and neither the jump equation nor the flight model does — ten
observed builds reproduce their angular rates only with the reserve excluded. Add the
reserve capacity where you are reproducing the panel, and nowhere else.

`Hull` and `Modules` are always computed from the hull record and the current fit, while
`Unladen` is the build's own unladen mass — which for an unedited import is the figure the
**capture** stated, and is the one every calculation here uses.

What the thrusters do with that mass is a three-point curve, and `Thrusters` publishes it
the way `FrameShiftDrive` publishes the jump constants:

```csharp
using EliteDangerousAlmanac.Ships;

ThrusterParams curve = metrics.Thrusters()!;
double rated = curve.OptMass; // 1440  rated performance at or below this
double ceiling = curve.MaxMass; // 2160  past this the ship does not move at all

metrics.MobilityMetricsResult().TryGetValue(out MobilityMetrics mobility);
double loaded = mobility.LoadedMass; // 1096  what the curve was evaluated at

bool agrees = Mobility.ThrusterMassCurveMultiplier(
    mobility.LoadedMass, curve.SpeedCurve ?? curve) == mobility.MassCurveMultiplier; // true
```

`MobilityMetricsResult` quotes speed, pitch, roll and yaw at **four** ENG pips, which is
the hull's own upper endpoint for each. A lower allocation is
`MobilityCapacitorMetricsResult`, the ENG half of the same split the shields and weapons
use:

```csharp
using EliteDangerousAlmanac.Ships;

metrics.MobilityMetricsResult().TryGetValue(out MobilityMetrics full);
double atFour = full.Speed; // m/s at four ENG pips

metrics.MobilityCapacitorMetricsResult(enginesPips: 2)
    .TryGetValue(out MobilityCapacitorMetrics half);
double atTwo = half.Speed;    // m/s at two
double pips = half.EnginesPips; // 2
```

Boost is not on the capacitor result, because the allocation cannot move it: it stays on
`MobilityMetricsResult` beside `LoadedMass` and the two curve multipliers the two share.
Both take the same load, so a screen can quote either at the same fuel and cargo.

`LoadedMass` against `OptMass` and `MaxMass` is the whole of "where does this build sit on
its thrusters" — the reading an outfitting screen shows beside the speed. A mass past the
maximum reports zero performance rather than a fabricated curve value, which is the same
convention the shield generator's own mass curve follows.

`Thrusters` is the fitted article's curve, so a switched-off or shed thruster still has
one; it is `MobilityMetricsResult` that decides whether the build can use it. It answers
`null` — rather than raising, as `FrameShiftDrive` does — when no complete curve is
fitted, because a build without usable thrusters is still a build.

## Jump range and fuel

`JumpRangeSummary` answers the loads a screen actually shows, so you do not have to
assemble them:

```csharp
using EliteDangerousAlmanac.Ships;

JumpRangeSummary jumps = metrics.JumpRangeSummary();

double best = jumps.Max;                // one jump's fuel, empty hold
double unladen = jumps.Unladen;         // full tank, empty hold
double laden = jumps.Laden;             // full tank, full hold
double bestTotal = jumps.TotalMax.Range;   // the same best jump as a one-jump total
int bestJumps = jumps.TotalMax.Jumps;      // one jump when the build carries fuel
double onATank = jumps.TotalUnladen.Range; // every jump on one tank, empty
int tankJumps = jumps.TotalUnladen.Jumps;  // including the final partial one
double loadedTank = jumps.TotalLaden.Range; // every jump on one tank, full

TotalRangeDetails tank = metrics.TotalRange();
double distance = tank.Range; // summed distance as the tank drains
int count = tank.Jumps;       // full and final-partial jumps before the tank is empty

// A chosen partial load, and the drive's dimensionless mass factor.
TotalRangeDetails partial = metrics.TotalRange(new BuildLoad(Fuel: 8, Cargo: 32));
double factor = metrics.FrameShiftDriveMassFactor();
```

The model is the community-standard hyperspace one, and
[JumpRange](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.JumpRange) holds it as data-free functions if you want a
single jump rather than a summary. Guardian FSD boosters and the drive's own engineering
are already folded in by the time `ShipLoadout` calls them. A frame shift drive has no
thruster-style three-point mass curve: its mass term is the direct
`optMass / (mass + fuel)` ratio, while a Guardian boost is added after that base equation.

## When a metric cannot be computed

The shield generator may be absent, and any fitted record may omit a stat a metric needs.
Do not treat an unavailable metric as zero:

- The `…Result` methods answer a
  [CalculationResult&lt;T&gt;](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.CalculationResult-1). One that is
  incomplete carries no value and its `Issues` name what was missing, switched off or
  shed. Each issue's `Reason` is `Missing`, `Unresolved`, `Disabled`, `Shed` or `Invalid`;
  use it instead of parsing the message.
- `UnladenMass`, `FuelCapacity`, `CargoCapacity`, `PassengerCapacity` and `BuildMass` are
  not nullable and have no diagnostic result: no article a build can hold is unweighable,
  so they always answer. `Thrusters` is nullable — it reports the fitted article's curve,
  and `MobilityMetricsResult` is what explains an unusable one.
  [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model) covers that split, and how it
  differs from the exceptions a malformed input raises.
- `ArmourMetrics` always has the known hull's base figures.
- A caller-supplied power plant without a usable capacity makes every power-dependent
  metric unavailable rather than projecting its dependants as powered. `PowerBudget`
  reports zero available; the mobility, shield and recovery results identify
  `CalculationField.PowerCapacity` directly. Those results report a non-positive or
  non-finite capacity as `Invalid` rather than asking `PowerBudget` to accept it; they
  likewise identify a malformed known module draw as `CalculationField.PowerDraw`. The
  direct budget remains strict and raises for either invalid numeric input.
- `JumpRangeSummary` and the other jump methods **raise** `InvalidOperationException`
  rather than answer, when the fitted drive's record carries no usable jump constants.
- `HeatMetricsResult` is incomplete when the build has no powered plant whose heat
  efficiency it can read, and its issue names which condition caused it.

**On an imported build, every figure here describes the fit that remains.** Import
discards a module in a removable mount and stocks armour, a core internal, the cargo hatch
and the planetary approach suite from the hull defaults, and neither the figures nor
`Validation` say so — [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model) says why.
What normalization can still do is leave a result incomplete for an ordinary reason:
discard the only shield generator and `ShieldMetricsResult` reports `ShieldGenerator` /
`Missing`, exactly as an empty mount would; stock a plant over an engineered one and the
mobility, shield and recovery results report `Shed`.

`ImportOutcomes` is the account, and it is the entries that matter, not the length. A
[ModuleDefaulted](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.ModuleDefaulted) whose `SourceSymbol` is `null`
marks a mount the capture named nothing for, which import stocks from the hull defaults. A
stocked bulkhead or approach suite moves no metric at all, and a stocked cargo hatch only
its own 0.6 MW draw — most third-party exports name neither the hatch nor an
approach-suite mount, so most produce exactly those two entries. Every other entry means
the figures are the normalized fit's — except two that mean the opposite.
[EngineeringUnresolved](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.EngineeringUnresolved) says nothing was
changed and that module's figures are the unengineered ones its source only claimed to
engineer. [EngineeringAmbiguous](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.EngineeringAmbiguous) says the fit
is one of two legitimate readings of an identity-only block: these figures are the roll,
and its `PreEngineeredVariant` is the catalogued article that would give a different set.

## Next

- [Engineering](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Engineering)
  — what a recipe may go on, and what it does to the stats above.
- [Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Building-an-outfitting-screen)
  — the screen these metrics feed.
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model)
- [API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.API)
