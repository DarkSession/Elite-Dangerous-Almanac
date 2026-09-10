Localized display text for everything the other namespaces catalogue.

[DisplayText](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Localization.Class.DisplayText)
is the whole surface: one lookup per kind of thing, each taking the identifier its owning
catalogue is keyed by — a Frontier symbol, the library identifier where the game publishes
none, or the region identifier for a galactic codex region — together with a BCP 47 tag.
[GameLocale](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Localization.Enumeration.GameLocale)
names the languages the game itself ships, and
[GameLocales](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Localization.Class.GameLocales)
matches an application's tag against them.

**English is complete; every other language is sparse.** A lookup answers `null` where the
pinned source carries no translation, which leaves the application in charge of its own
fallback policy rather than having one imposed on it. The mount labels, slot names and
diagnostic messages this package writes itself are English prose, so they answer for an
English tag alone.
