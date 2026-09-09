---
title: The failure model
---

[.NET](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet) / The failure model

# The failure model

The library keeps three things apart: *there is no such thing*, *you passed me nonsense*,
and *this build does not carry what the figure needs*. Each has its own shape, and once
you know the three you can write a consumer that never guesses.

| Outcome | Means |
| --- | --- |
| `null` | Nothing matched, or the scan did not state the field |
| An exception | The argument or the payload could not be used at all |
| [CalculationResult&lt;T&gt;](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.CalculationResult-1) | The build is missing an input the metric needs |

## `null` is an ordinary answer

A lookup that matches nothing answers `null`. That is not an error and nothing is thrown:
a symbol the catalogue does not carry is a normal thing for an application to ask about.

```csharp
using EliteDangerousAlmanac.Ships;

Ship? hull = ShipCatalogue.FindBySymbol("no such hull"); // null
```

A body or star calculation answers `null` too, for a different reason: a scan states one
line of figures, and a field it did not write has only one meaning — the scan did not
write it. There is nothing to compute from and nothing to complain about.

## An exception is a caller bug or unusable data

An argument the call cannot use at all raises rather than answering. A missing argument is
an `ArgumentNullException`; one that is well formed but outside the range the call accepts
is an `ArgumentOutOfRangeException`; one that is the wrong shape is an `ArgumentException`.

Wire data that cannot be read raises where it is read: a payload that is not JSON raises
`JsonException`, and one that is JSON but not the format claimed raises `FormatException`.
[Slef.Parse](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Slef)
is the entry point that shows both.

An edit a build cannot accept — a module in a mount that does not take it, a limit the
hull already reached — raises a
[LoadoutEditException](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.LoadoutEditException).
It is an `ArgumentException`, and it carries a stable code and the constraint that refused
the edit, so an application reacts to those rather than to the English message.

An `InvalidOperationException` says the object cannot answer in the state it is in. A jump
figure on a hull with no frame shift drive is the example: there is no drive to compute
from, and the caller asked anyway.

## A build metric answers with its evidence

Most ship figures are ordinary calculations that answer a value. The ones whose result
depends on what the build carries answer a
[CalculationResult&lt;T&gt;](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.CalculationResult-1)
instead — they are the
[BuildMetrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.BuildMetrics)
methods whose names end in `Result`. Each one carries either the figure or the inputs that
stopped it.

```csharp
using EliteDangerousAlmanac.Ships;

BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));
CalculationResult<ShieldMetrics> shields = metrics.ShieldMetricsResult();

if (shields.TryGetValue(out ShieldMetrics figures))
{
    // The build carries a shield generator, and `figures` is its shield strength.
}
else
{
    foreach (CalculationIssue issue in shields.Issues)
    {
        // issue.Field says which input, issue.Reason says why it is unavailable,
        // and issue.Slot and issue.Symbol name the module when one is at fault.
    }
}
```

An incomplete result never exposes a misleading partial value: reading `Value` on one
raises `InvalidOperationException`, so the only way to a figure is through a check that
the figure exists.

**Why not `null` here.** "No shield generator fitted", "the generator is switched off" and
"the priority budget sheds it" are three different answers an outfitting screen wants to
show differently, and `null` collapses them into one.
[CalculationIssue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.CalculationIssue)
keeps them apart, with a
[CalculationField](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Enumeration.CalculationField)
naming the input and a
[CalculationIssueReason](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Enumeration.CalculationIssueReason)
naming the kind of unavailability.

The English reading beside each issue is for a log or a validation panel. The stable codes
are what an application should branch on, and
[DisplayText](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Localization.Class.DisplayText)
turns one into a message when you want to show it.

## The same model in TypeScript

The TypeScript package makes the same three distinctions with the shapes that language
uses — `null`, `TypeError`/`RangeError`/`SyntaxError`, and a diagnostic result. Its
[failure model guide](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
covers them.
