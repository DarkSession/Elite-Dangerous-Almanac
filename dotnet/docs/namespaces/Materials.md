The two things a commander collects and spends: ship engineering materials, and the
Odyssey micro resources on-foot engineering asks for.

[MaterialCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Materials.Class.MaterialCatalogue)
holds the raw, manufactured and encoded materials, each a
[Material](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Materials.Record.Material)
carrying its category, its line and its
[MaterialGrade](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Materials.Enumeration.MaterialGrade)
— which is the material's rarity, so there is no separate rarity field to keep in step.

[MicroResourceCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Materials.Class.MicroResourceCatalogue)
holds the components, data, items and consumables, each a
[MicroResource](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Materials.Record.MicroResource).

Both catalogues take a name or a symbol in any casing, with any surrounding whitespace,
and answer `null` for one no record carries.
