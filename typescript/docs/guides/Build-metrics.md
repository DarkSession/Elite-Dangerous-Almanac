---
title: Build metrics
---

# Build metrics

How this library arrives at the numbers an outfitting screen shows — power, shields,
armour, resistances, weapon output, ammunition, heat and jump range. Each metric has its own
page in the API reference; this is the argument that runs through all of them, which no
single symbol owns.

## Two layers, and which one you want

Every metric exists twice, and the difference is where the numbers come from rather than
what the maths does.

The **calculation modules** — `ships/power`, `ships/shields`, `ships/armour`,
`ships/resistances`, `ships/weapons`, `ships/ammunition`, `ships/heat`, `ships/jump-range` — are
data-free. You hand them the constants and they hand back a figure. They bundle to almost
nothing, and they are the right layer for a what-if tool that is not modelling a real
build.

```ts
import { powerBudget } from '@elite-dangerous-almanac/core/ships/power';

powerBudget(20.4, [
    { draw: 0.45, priority: 1 }, // life support
    { draw: 5.72, priority: 1 }, // thrusters
    { draw: 2.48, priority: 3, deployedOnly: true }, // a beam laser
]).deployed; // -> 8.65
```

The **{@link ships!BuildMetrics | BuildMetrics} methods** of the same name gather those constants out of a
real build — the fitted modules, the hull, and whatever engineering each module carries —
and call the function for you. This is what an outfitting screen wants. Attach one to a
{@link ships!ShipLoadout | ShipLoadout} with `BuildMetrics.of(build)`.

```ts
import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';

declare const metrics: BuildMetrics; // a Federal Corvette

metrics.powerBudget().deployed; // -> 46.8597
metrics.shieldMetricsResult().value?.strength; // -> 3940.4
metrics.armourMetrics().hitPoints; // -> 5062.6
metrics.weaponMetrics().total.damagePerSecond; // -> 137.04
```

The rest of this page is about the second layer, because the first is documented where it
lives: each function's own page states its formula, its units and its reference
implementation.

## Engineering happens first

Every `BuildMetrics` figure reads **post-engineering** stats. A build's modifiers are
folded onto the module's catalogue values before any metric sees them, so there is no
step where a caller applies engineering themselves — and no way to ask for the stock
figure through these methods.

Two consequences are worth knowing before you read a number.

**A journal's own modifiers are never recomputed.** When a build comes from
`fromLoadout` or `fromSlef`, the `Engineering.Modifiers` block the game wrote is taken as
stated. That is deliberate: the game is the
authority on a build it exported, and a recomputation that disagreed would silently
replace a fact with a model. The library recomputes only what it rolled itself, through
{@link ships!ShipLoadout.applyBlueprint | applyBlueprint} — which includes a block that
states a recipe and *no* `Modifiers`, since there is then no fact to replace. See
[Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Working-with-SLEF#a-recipe-stated-without-its-modifiers-is-rolled)
for what such a block resolves to.

**Four stats are percentages of a multiplier, not of the stat.** Hull boost, shield boost
and the four damage resistances compound on `1 + v` and `1 − v` respectively, whichever
apply method the recipe names. A `+80%` bulkhead engineered by a `+32%` blueprint reads
`137.6%`, not `105.6%`, because `1.8 × 1.32 − 1 = 1.376`; a `−20%` kinetic resistance with
`+5%` becomes `−14%`, because the multipliers `1.2 × 0.95` multiply. This is Frontier's
own convention and it is why those four stats look wrong if you read them as ordinary
percentages. `ships/engineering` states the rule; every metric below inherits it.

## Power

The plant's capacity against what the build draws, split two ways because weapons and most
utility fittings only draw while the hardpoints are **deployed**.

```ts
import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';

declare const metrics: BuildMetrics;

const power = metrics.powerBudget();
power.available; // MW the plant makes
power.retracted; // MW drawn with hardpoints in
power.deployed; // MW drawn with hardpoints out
power.withinBudget; // does it fit?
power.bands; // the five priority groups
power.consumers; // positive draws, normalized in source order
```

`bands` is what drives a priority-group table. A group is powered when its **running
total** — its own draw plus every higher-priority group's — fits in `available`; the game
shuts off the first group that would go over and everything below it, rather than the
individual module that broke the budget.

`consumers` keeps every positive power draw in source order and normalizes the fields
used by the budget; passive and zero-draw fittings are absent.

## Shields and armour share a resistance model

Strength and hit points are separate calculations, but the four resistances that decide
what they are worth stack by one shared rule, in `ships/resistances`.

Sources stack **multiplicatively on the damage multiplier**, not additively on the
resistance: two 20% resisters leave `0.8 × 0.8 = 0.64`, which is 36% resisted, not 40%.
The game then bends the result so stacking cannot run away — past a threshold, the
remaining gain is halved. The threshold differs between shields and hull, and both are
stated on {@link ships!stackShieldResistance | stackShieldResistance} and
{@link ships!stackArmourResistance | stackArmourResistance}.

```ts
import { stackShieldResistance } from '@elite-dangerous-almanac/core/ships/resistances';

// A stock generator at 40% kinetic, under four 20% resistance-augmented boosters.
stackShieldResistance(0.4, [0.2, 0.2, 0.2, 0.2]); // -> 0.667…, not 0.4 + 4 × 0.2
```

What a resistance is worth is the **effective hit points** it buys — the pool divided by
what still gets through. Both metrics report that per damage type, and
{@link ships!effectiveHitPoints | effectiveHitPoints} is the same function they use, so a
pool of your own converts the same way:

```ts
import { effectiveHitPoints } from '@elite-dangerous-almanac/core/ships/resistances';

// 945 hull points behind lightweight alloy, which is weak to kinetic (-20%) and
// explosive (-40%) damage alike.
effectiveHitPoints(945, { kinetic: -0.2, thermal: 0, explosive: -0.4, caustic: 0 }).kinetic;
// -> 787.5, fewer than the hull holds
```

Two things about shields catch people out. A generator's strength multiplier is read off a
curve against the **bare hull mass**, not the loaded ship — so fitting more modules never
weakens your shields. And past the generator's `maxMass` it will not raise a shield at
all, which the curve reports as `0` rather than as a small number.

`shieldMetricsResult()` evaluates the generator, boosters and reinforcement against the
hardpoints-stowed (`retracted`) budget. Its `value` is `null` when no generator is powered
in that state, and its issues distinguish a missing, switched-off or shed generator from
an unavailable power supply. Every imported build has a known hull and armour.
`mobilityMetricsResult()` and `shieldRecoveryResult()` use the same retracted power state
for their thrusters, generator and distributor, and explain an unavailable answer in the
same way.

**The pips are a separate call.** `shieldMetricsResult().value` is the bare shield an
outfitting screen shows, and the SYS capacitor is
`shieldCapacitorMetricsResult().value` — the same split `weaponMetrics()` and
`weaponsCapacitorMetrics()` already use for WEP. It reports the SYS capacity and recharge
the allocation buys, the resistance the pips add on their own, and the effective
resistances and hit points with them folded in, so a panel showing both readings computes
the shield once:

```ts
import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));

metrics.shieldMetricsResult().value?.resistances.kinetic; // the generator and boosters alone
const sys = metrics.shieldCapacitorMetricsResult({ systemsPips: 2 }).value;
sys?.systemsResistance; // what two pips add, on their own
sys?.effectiveResistances.kinetic; // the two, multiplied together
sys?.effectiveHitPoints.kinetic; // MJ of kinetic damage soaked at two pips
sys?.rechargeRate; // MJ/s into the SYS capacitor at two pips
```

The pips multiply with the shield's own stack rather than adding to it, which is why the
capacitor owns the arithmetic: `1 − (1 − shieldResistance) × (1 − systemsResistance)`. At
zero pips the effective figures are the bare ones, exactly.

`shieldRecoveryResult().value` keeps its own `systemsPips`. Every figure it contains is a
function of the allocation — there is no unpiped recovery time to report — so nothing
there is being folded into a base figure and then discarded. Its recharge is the
`rechargeRate` in `shieldCapacitorMetricsResult().value` at the same allocation.

## Weapon output

`weaponMetrics()` reports per-weapon figures and a total. The distinction that matters is
**damage per second** against **sustained** damage per second: the first is the rate while
firing, the second folds in the clip and the reload, because a weapon that stops to reload
is not firing.

```ts
import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';

declare const metrics: BuildMetrics;

const weapons = metrics.weaponMetrics();
weapons.total.damagePerSecond; // while firing
weapons.total.sustainedDamagePerSecond; // with reloads
weapons.total.energyPerSecond; // weapons capacitor draw, MW
weapons.total.heatPerSecond;
weapons.weapons.length; // per-hardpoint breakdown

const distributor = metrics.distributorMetricsResult({
    systemsPips: 2,
    enginesPips: 2,
    weaponsPips: 2,
}).value;
distributor?.engines.ratedRecharge; // four-pip catalogue rate, MJ/s
distributor?.engines.rechargeRate; // actual ENG recharge at two pips, MJ/s

const capacitor = metrics.weaponsCapacitorMetrics({ weaponsPips: 2 });
capacitor.rechargeRate; // actual WEP recharge at two pips, MJ/s
capacitor.netDrainRate; // sustained draw minus recharge, floored at zero
capacitor.timeToDrain; // seconds from full, or Infinity when recharge keeps pace
```

Beam and mining lasers are **continuous**: they carry no rate of fire, and their damage,
distributor draw and thermal load are already per second, so the per-shot arithmetic
collapses to the raw stats.

A distributor's three catalogue recharge figures are their four-pip maxima.
`distributorMetricsResult().value` scales SYS, ENG and WEP independently by
`(pips / 4) ^ 1.1` and returns each capacity, rated recharge and actual rate. Fractional
allocations from zero through four are accepted; each defaults to four independently and
they need not total six, so the result can compare three independent scenarios. It
returns `null` without a powered distributor or when the fitted article's capacitor stats
cannot be resolved; `distributorMetricsResult()` says which of those four it was.

`weaponsCapacitorMetrics()` adds firing endurance to the WEP calculation. It compares
pip-scaled recharge with **sustained** energy per second: a magazine's reload is time for
the capacitor to recover, so burst draw would understate endurance.

The general distributor facade applies the **retracted** power budget: all three
capacitors recharge while hardpoints are stowed. Weapons endurance instead applies the
**deployed** budget, because its result models firing. A distributor or weapon shed in
the relevant state contributes nothing.

One asymmetry is deliberate. Frontier's Rapid Fire and High Capacity recipes shorten the
**fire interval** rather than raising the rate of fire, so that is the label those
blueprints carry; a weapon's combined rate of fire follows from the interval and the burst
pattern. `ShipLoadout` recomputes it for you, so you only meet this if you call
{@link ships!computeModifiers | computeModifiers} directly.

## Ammunition, and why it rounds

{@link ships!ammunitionCapacity | ammunitionCapacity} reports what a module *can* hold when
fully rearmed — the magazine, the reserve behind it, and the two together. A journal's
`AmmoInClip` and `AmmoInHopper` report what is loaded at the moment of capture, which is a
different question: a reading is a **lower bound** on a capacity and never a reading of
one, so the library never infers a catalogue figure from a rearm state.

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
the clip is a published figure rather than a product of one, and a roll that leaves the clip
where it was leaves it there.

There is one more wrinkle, and it exists because registries state a recipe's multiplier to
three or four decimals. A leg meant to add two thirds is written `0.667`, which computes
10.002 rounds on a 6-round rack — and left alone that thousandth becomes a whole extra
round once the clip rounds up, or a whole extra burst on a burst weapon. A clip within half
a unit in the multiplier's third decimal is therefore taken as the whole number it means. A
quality roll between two published legs gets no such treatment: it is a real number with no
whole magazine behind it.

## Heat

What the build runs at, and whether firing everything cooks it. Heat is the one metric
here that no stated Frontier figure underwrites: the game publishes no formula and shows
no dissipation figure, so the model — and the per-hull `heatDissipation` it reads — is
community measurement of the game, ported from EDSY and credited in `ATTRIBUTIONS.md`.

```ts
import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';

declare const metrics: BuildMetrics;

const heat = metrics.heatMetricsResult().value;
heat?.idle.gauge; // hardpoints stowed, as the cockpit gauge reads it: 1 is 100%
heat?.fsdCharging.gauge; // spooling a jump, the hottest thing most ships do
heat?.firingSustained.overheats; // holding the trigger with the WEP capacitor keeping up
heat?.firingDrained.secondsToOverheat; // and the alpha strike, on an empty capacitor
```

Two numbers decide everything, and they are not interchangeable. **Dissipation** is a
ceiling: a build whose thermal load stays under the hull's `heatDissipation` settles below
heat level 1 and never overheats, however long it fires; one that goes over never settles
at all. **Capacity** is only inertia — it sets how long the climb takes, which is why a
build that cooks itself in eight seconds and one that cooks itself in two are the same
kind of broken.

Heat follows what the plant **actually feeds**. A module switched off makes no heat, and
neither does one in a priority group the plant cannot keep lit — including the thrusters
and the guns. That check is state-dependent, so a build whose thrusters survive with the
hardpoints stowed but get shed once they are out reports thruster heat in `thrusters` and
none in the firing scenarios.

Each scenario is cumulative, and each reports both a settled level and a countdown:
`gauge` is the level as a fraction of the in-game readout, `overheats` says whether it
settles at all, and `secondsToOverheat` fills in when it does not. A load beyond
dissipation reports `Infinity` for the level rather than a settling point it never
reaches.

Weapons are the part worth reading twice. `firingSustained` and `firingDrained` differ
only in the state of the weapons capacitor, and the gap is large: a shot the capacitor
cannot pay for makes **five times** its thermal load. A build that never overheats in a
duel can cook itself in a wing fight with the same guns.

## Mass, and how the thrusters read it

Mass is the input half of the flight model, so the library publishes it rather than
leaving a screen to reassemble it. `buildMass()` is the mass counterpart of
`buildCost()`, and splits the same three ways:

```ts
import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));

const mass = metrics.buildMass();
mass.hull; // -> 400      the bare hull, in tonnes
mass.modules; // -> 664      every fitted module, post-engineering
mass.unladen; // -> 1064     what `ShipLoadout.unladenMass` reports
mass.total; // -> 1096     with the load below aboard
mass.fuel; // -> 32       a full main tank by default
mass.cargo; // -> 0        an empty hold by default

metrics.buildMass({ fuel: 8, cargo: 32 }).total; // -> 1104
```

`fuel` and `cargo` default exactly as they do for `jumpRange()` and
`mobilityMetricsResult()`, so the three agree by construction. Each of the standard loads
carries its own resulting mass too:

```ts
import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));
metrics.standardLoadResult('laden').value?.mass; // -> 1210
```

**The reserve tank is in none of these.** The game's statistics panel counts it in the
current mass it displays, and neither the jump equation nor the flight model does — ten
observed builds reproduce their angular rates only with the reserve excluded. Add
`fuelCapacity.reserve` where you are reproducing the panel, and nowhere else.

`hull` and `modules` are always computed from the hull record and the current fit, while
`unladen` is the build's own unladen mass — which for an unedited import is the figure
the **capture** stated, and is the one every calculation here uses.

What the thrusters do with that mass is a three-point curve, and `thrusters()` publishes
it the way `frameShiftDrive()` publishes the jump constants:

```ts
import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
import { thrusterMassCurveMultiplier } from '@elite-dangerous-almanac/core/ships/mobility';

const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));

const curve = metrics.thrusters()!;
curve.optMass; // -> 1440   rated performance at or below this
curve.maxMass; // -> 2160   past this the ship does not move at all

const mobility = metrics.mobilityMetricsResult().value!;
mobility.loadedMass; // -> 1096   what the curve was evaluated at
thrusterMassCurveMultiplier(mobility.loadedMass, curve) === mobility.massCurveMultiplier; // -> true
```

`mobilityMetricsResult().value` quotes speed, pitch, roll and yaw at **four** ENG pips,
which is the hull's own upper endpoint for each. A lower allocation is
`mobilityCapacitorMetricsResult().value`, the ENG half of the same split the shields and
weapons use:

```ts
import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));

metrics.mobilityMetricsResult().value?.speed; // m/s at four ENG pips
metrics.mobilityCapacitorMetricsResult({ enginesPips: 2 }).value?.speed; // m/s at two
metrics.mobilityCapacitorMetricsResult({ enginesPips: 0 }).value?.enginesPips; // -> 0
```

Boost is not on the capacitor result, because the allocation cannot move it: it stays on
`mobilityMetricsResult().value` beside `loadedMass` and the two curve multipliers the two
share. Both take the same `fuel` and `cargo`, so a screen can quote either at the same
load.

`loadedMass` against `optMass` and `maxMass` is the whole of "where does this build sit
on its thrusters" — the reading an outfitting screen shows beside the speed. A mass past
`maxMass` reports zero performance rather than a fabricated curve value, which is the
same convention the shield generator's own mass curve follows.

`thrusters()` is the fitted article's curve, so a switched-off or shed thruster still
has one; it is `mobilityMetricsResult()` that decides whether the build can use it. It
answers `null` — rather than throwing, as `frameShiftDrive()` does — when no complete
curve is fitted, because a build without usable thrusters is still a build.

## Jump range and fuel

`jumpRangeSummary()` returns the loads a screen actually shows, so you do not have to
assemble them:

```ts
import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';

declare const metrics: BuildMetrics;

const jumps = metrics.jumpRangeSummary();
jumps.max; // best single jump: one jump's fuel, empty hold
jumps.unladen; // full tank, empty hold
jumps.laden; // full tank, full hold
jumps.totalMax.range; // the same best jump as a one-jump total
jumps.totalMax.jumps; // one jump when the build carries fuel
jumps.totalUnladen.range; // every jump on one tank, empty
jumps.totalUnladen.jumps; // number of jumps, including the final partial one
jumps.totalLaden.range; // every jump on one tank, full

const tank = metrics.totalRange();
tank.range; // summed distance as the tank drains
tank.jumps; // full and final-partial jumps before the tank is empty

metrics.totalRange({ fuel: 8, cargo: 32 }); // total for a chosen partial load

metrics.frameShiftDriveMassFactor(); // optMass / loadedMass, dimensionless
```

The model is the community-standard hyperspace one, and `ships/jump-range` holds it as
pure functions if you want a single jump rather than a summary. Guardian FSD boosters and
the drive's own engineering are already folded in by the time `ShipLoadout` calls them.
An FSD has no thruster-style three-point mass curve: its mass term is the direct
`optMass / (mass + fuel)` ratio, while a Guardian boost is added after that base equation.

## When a metric cannot be computed

The shield generator may be absent, and any fitted record may omit a stat a metric needs.
Do not assume a nullable figure is load-bearing:

- Eight `…Result` methods can be unavailable. Their `value` is `null` and `issues` names
  what was missing, switched off or shed. Each issue's typed `reason` is
  `missing`, `unresolved`, `disabled`, `shed` or `invalid`; use it instead of parsing the
  diagnostic message.
- `unladenMass`, `fuelCapacity`, `cargoCapacity` and `buildMass()` are not nullable and
  have no diagnostic result: no article a build can hold is unweighable, so they always
  answer. `thrusters` is nullable — it reports the
  fitted article's curve, and `mobilityMetricsResult()` is what explains an unusable one.
  [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
  covers that split, and how it differs from the errors a malformed input raises.
- `armourMetrics()` always has the known hull's base figures.
- A caller-supplied power plant without a usable capacity makes every power-dependent
  metric unavailable rather than projecting its dependants as powered. `powerBudget()`
  reports `available: 0`; the mobility, shield and recovery results identify
  `powerCapacity` directly. Those results report a non-positive or non-finite
  capacity as `invalid` rather than asking `powerBudget()` to accept it; they likewise
  identify a malformed known module draw as `powerDraw`. The direct budget remains strict
  and throws for either invalid numeric input.
- `jumpRangeSummary()` and the other jump methods **throw** `TypeError` rather than
  answer, when the fitted drive's record carries no usable jump constants.
- `heatMetricsResult()` returns a null value when the build has no powered plant whose
  heat efficiency it can read, and its issue names which condition caused it.

**On an imported build, every figure here describes the fit that remains.** Import
discards a module in a removable mount and stocks armour, a core internal, the cargo hatch
and the planetary approach suite from the hull defaults, and neither the figures nor
`validation` say so —
[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
says why. What normalization can still do is leave a result incomplete for an ordinary
reason: discard the only shield generator and `shieldMetricsResult` reports
`shieldGenerator` / `missing`, exactly as an empty mount would; stock a plant over an
engineered one and the mobility, shield and recovery results report `shed`.

`build.importOutcomes` is the account, and it is the entries that matter, not the length.
A `sourceSymbol` of `null` marks a mount the capture named nothing for, which import
stocks from the hull defaults. A stocked bulkhead or approach suite moves no metric at all,
and a stocked cargo hatch only its own 0.6 MW draw — most third-party exports name neither
the hatch nor an approach-suite mount, so most produce exactly those two entries. Every other entry means the figures are the normalized
fit's — except two that mean the opposite. `unresolvedEngineering` says nothing was
changed and that module's figures are the unengineered ones its source only claimed to
engineer. `ambiguousEngineering` says the fit is one of two legitimate readings of an
identity-only block: these figures are the roll, and `preEngineeredVariant` is the
catalogued article that would give a different set.

## Next

- [Engineering](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Engineering)
  — what a recipe may go on, and what it does to the stats above.
- [Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Building-an-outfitting-screen)
  — the screen these metrics feed.
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
