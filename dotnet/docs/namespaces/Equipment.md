On-foot equipment: the suits, the handheld weapons and the tools an Odyssey commander
carries, with what upgrading and engineering one costs.

[SuitCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Class.SuitCatalogue),
[PersonalWeaponCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Class.PersonalWeaponCatalogue)
and
[PersonalToolCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Class.PersonalToolCatalogue)
are the three catalogues; each takes a name or a symbol in any casing and answers `null`
for a miss.

A grade is a separate record from the item, because a suit's figures change with it:
[SuitGrade](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Record.SuitGrade)
and
[PersonalWeaponGrade](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Record.PersonalWeaponGrade).
[PersonalUpgradeCosts](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Class.PersonalUpgradeCosts)
prices a step up that ladder,
[PersonalModificationCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Class.PersonalModificationCatalogue)
holds the engineering recipes and what each one costs, and
[PersonalEngineering](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Class.PersonalEngineering)
does the arithmetic a modification applies.

[SuitLoadout.Parse](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Record.SuitLoadout)
reads a journal `SuitLoadout` event into a
[SuitLoadout](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Record.SuitLoadout),
so what a commander is actually wearing reads back with the same records the catalogues
answer with, and states what it could not fit rather than dropping it.
