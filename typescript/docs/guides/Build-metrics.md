---
title: Build metrics
---

# Build metrics

How this library arrives at the numbers an outfitting screen shows — power, shields,
armour, resistances, weapon output, ammunition and jump range. Each metric has its own
page in the API reference; this is the argument that runs through all of them, which no
single symbol owns.

## Two layers, and which one you want

Every metric exists twice, and the difference is where the numbers come from rather than
what the maths does.

The **calculation modules** — `ships/power`, `ships/shields`, `ships/armour`,
`ships/resistances`, `ships/weapons`, `ships/ammunition`, `ships/jump-range` — are
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
```

`bands` is what drives a priority-group table. A group is powered when its **running
total** — its own draw plus every higher-priority group's — fits in `available`; the game
shuts off the first group that would go over and everything below it, rather than the
individual module that broke the budget.

A module whose draw the library cannot determine is named in
{@link ships!PowerBudget.unknownDraws | unknownDraws} rather than counted as zero, so a
budget is never quietly optimistic about a module newer than the catalogue.

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

Two things about shields catch people out. A generator's strength multiplier is read off a
curve against the **bare hull mass**, not the loaded ship — so fitting more modules never
weakens your shields. And past the generator's `maxMass` it will not raise a shield at
all, which the curve reports as `0` rather than as a small number.

`shieldMetrics()` returns `null` when the build has no generator; `armourMetrics()` always
returns a figure, because every hull has armour.

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
```

Beam and mining lasers are **continuous**: they carry no rate of fire, and their damage,
distributor draw and thermal load are already per second, so the per-shot arithmetic
collapses to the raw stats.

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
jumps.totalUnladen; // every jump on one tank, empty
jumps.totalLaden; // every jump on one tank, full
```

The model is the community-standard hyperspace one, and `ships/jump-range` holds it as
pure functions if you want a single jump rather than a summary. Guardian FSD boosters and
the drive's own engineering are already folded in by the time `ShipLoadout` calls them.

## When a metric cannot be computed

A build can contain a module the catalogue cannot classify — usually one newer than the
data. Metrics that depend on it follow the library's standard split rather than guessing:
a nullable convenience property, and a result that names what was missing.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

build.cargoCapacity; // number | null
build.cargoCapacityResult; // names every rack it could not classify
```

[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
covers that pattern in full, including how it differs from the errors a malformed input
raises.

## Next

- [Engineering](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Engineering)
  — what a recipe may go on, and what it does to the stats above.
- [Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Building-an-outfitting-screen)
  — the screen these metrics feed.
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
