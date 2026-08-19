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

The **{@link ships!ShipLoadout | ShipLoadout} methods** of the same name gather those constants out of a
real build — the fitted modules, the hull, and whatever engineering each module carries —
and call the function for you. This is what an outfitting screen wants.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout; // a Federal Corvette

build.powerBudget().deployed; // -> 46.8597
build.shieldMetrics()?.strength; // -> 3940.4
build.armourMetrics().hitPoints; // -> 5062.6
build.weaponMetrics().total.damagePerSecond; // -> 137.04
```

The rest of this page is about the second layer, because the first is documented where it
lives: each function's own page states its formula, its units and its reference
implementation.

## Engineering happens first

Every `ShipLoadout` metric reads **post-engineering** stats. A build's modifiers are
folded onto the module's catalogue values before any metric sees them, so there is no
step where a caller applies engineering themselves — and no way to ask for the stock
figure through these methods.

Two consequences are worth knowing before you read a number.

**A journal's own modifiers are never recomputed.** When a build comes from
`fromLoadout` or `fromSlef`, the `Engineering.Modifiers` block the game wrote is taken as
stated. That is deliberate: the game is the
authority on a build it exported, and a recomputation that disagreed would silently
replace a fact with a model. The library recomputes only what it rolled itself, through
{@link ships!ShipLoadout.applyBlueprint | applyBlueprint}.

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
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

const power = build.powerBudget();
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

`shieldMetrics()` evaluates the generator, boosters and reinforcement against the
hardpoints-stowed (`retracted`) budget. It returns `null` when no generator is powered in
that state. `shieldMetricsResult()` distinguishes a missing, switched-off or shed generator
from an unavailable power supply. Every imported build has a known hull and armour.
`mobilityMetrics()` and `shieldRecovery()` use the same retracted power state for their
thrusters, generator and distributor, and their `…Result` companions explain an unavailable
answer in the same way.

## Weapon output

`weaponMetrics()` reports per-weapon figures and a total. The distinction that matters is
**damage per second** against **sustained** damage per second: the first is the rate while
firing, the second folds in the clip and the reload, because a weapon that stops to reload
is not firing.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

const weapons = build.weaponMetrics();
weapons.total.damagePerSecond; // while firing
weapons.total.sustainedDamagePerSecond; // with reloads
weapons.total.energyPerSecond; // weapons capacitor draw, MW
weapons.total.heatPerSecond;
weapons.weapons.length; // per-hardpoint breakdown

const distributor = build.distributorMetrics({
    systemsPips: 2,
    enginesPips: 2,
    weaponsPips: 2,
});
distributor?.engines.ratedRecharge; // four-pip catalogue rate, MJ/s
distributor?.engines.rechargeRate; // actual ENG recharge at two pips, MJ/s

const capacitor = build.weaponsCapacitorMetrics({ weaponsPips: 2 });
capacitor.rechargeRate; // actual WEP recharge at two pips, MJ/s
capacitor.netDrainRate; // sustained draw minus recharge, floored at zero
capacitor.timeToDrain; // seconds from full, or Infinity when recharge keeps pace
```

Beam and mining lasers are **continuous**: they carry no rate of fire, and their damage,
distributor draw and thermal load are already per second, so the per-shot arithmetic
collapses to the raw stats.

A distributor's three catalogue recharge figures are their four-pip maxima.
`distributorMetrics()` scales SYS, ENG and WEP independently by `(pips / 4) ^ 1.1` and
returns each capacity, rated recharge and actual rate. Fractional allocations from zero
through four are accepted; each defaults to four independently and they need not total
six, so the result can compare three independent scenarios. It returns `null` without a
powered distributor or when the fitted article's capacitor stats cannot be resolved.

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
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

const heat = build.heatMetrics();
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

## Jump range and fuel

`jumpRangeSummary()` returns the loads a screen actually shows, so you do not have to
assemble them:

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

const jumps = build.jumpRangeSummary();
jumps.max; // best single jump: one jump's fuel, empty hold
jumps.unladen; // full tank, empty hold
jumps.laden; // full tank, full hold
jumps.totalMax.range; // the same best jump as a one-jump total
jumps.totalMax.jumps; // one jump when the build carries fuel
jumps.totalUnladen.range; // every jump on one tank, empty
jumps.totalUnladen.jumps; // number of jumps, including the final partial one
jumps.totalLaden.range; // every jump on one tank, full

const tank = build.totalRange();
tank.range; // summed distance as the tank drains
tank.jumps; // full and final-partial jumps before the tank is empty

build.totalRange({ fuel: 8, cargo: 32 }); // total for a chosen partial load

build.frameShiftDriveMassFactor(); // optMass / loadedMass, dimensionless
```

The model is the community-standard hyperspace one, and `ships/jump-range` holds it as
pure functions if you want a single jump rather than a summary. Guardian FSD boosters and
the drive's own engineering are already folded in by the time `ShipLoadout` calls them.
An FSD has no thruster-style three-point mass curve: its mass term is the direct
`optMass / (mass + fuel)` ratio, while a Guardian boost is added after that base equation.

## When a metric cannot be computed

A required module can be absent, and a known or caller-supplied record can omit a stat a
metric needs. Do not assume a nullable figure is load-bearing:

- `unladenMass`, `fuelCapacity`, `cargoCapacity`, `mobilityMetrics()`, `shieldMetrics()`
  and `shieldRecovery()` come in nullable/`…Result` pairs: the convenience value is
  `null` and the result names what was missing, switched off or shed. Each issue's typed
  `reason` is `missing`, `unresolved`, `disabled`, `shed` or `invalid`; use it instead of
  parsing the diagnostic message.
  [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
  covers that split, and how it differs from the errors a malformed input raises.
- `armourMetrics()` always has the known hull's base figures.
- A caller-supplied power plant without a usable capacity makes every power-dependent
  metric unavailable rather than projecting its dependants as powered. `powerBudget()`
  reports `available: 0`; the mobility, shield and recovery result companions identify
  `powerCapacity` directly. Those result companions report a non-positive or non-finite
  capacity as `invalid` rather than asking `powerBudget()` to accept it; they likewise
  identify a malformed known module draw as `powerDraw`. The direct budget remains strict
  and throws for either invalid numeric input.
- `jumpRangeSummary()` and the other jump methods **throw** `TypeError` rather than
  answer, because the mass they need is unknown.
- `heatMetrics()` returns `null` outright when the build has no powered plant.

Use each available `…Result` companion before trusting a nullable metric.

**On an imported build, every figure here is a figure about the fit that remains.**
`ShipLoadout.fromLoadout` and `ShipLoadout.fromSlef` normalize what the catalogues cannot
resolve — a module in a removable mount is discarded, and armour, a core internal or the
cargo hatch is replaced with the hull's stock article. The metrics then answer for the
normalized fit, and nothing above reports the substitution itself: a stocked power plant
states its own capacity, a discarded rack simply stops counting, and `validation` calls
the result complete, because the fit that remains really is filled and really is legal.
What normalization can still do is leave a companion incomplete for an ordinary reason,
saying nothing about the module that was there. Drop the build's only shield generator
and `shieldMetricsResult` reports `shieldGenerator` / `missing`, exactly as an empty
mount would. A stocked fixed mount does it too, because a hull's default is its class-1
article: substitute one for an engineered power plant and a build sized for the original
sheds groups, so the mobility, shield and recovery companions report `shed`.

`build.importOutcomes` is the only account of any of this. Read it on a build you did
not assemble yourself, and read the entries rather than the length: an entry whose
`sourceSymbol` is `null` is the cargo hatch restored to a capture that named none, which
is free and weightless and changes no figure — most third-party exports omit the hatch,
so most produce exactly that one entry. Any other entry means the figures describe the
normalized fit rather than the capture.

## Next

- [Engineering](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Engineering)
  — what a recipe may go on, and what it does to the stats above.
- [Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Building-an-outfitting-screen)
  — the screen these metrics feed.
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
