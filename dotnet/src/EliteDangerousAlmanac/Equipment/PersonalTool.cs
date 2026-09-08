using System.Collections.Generic;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>One suit tool, and the figures the game publishes for it.</summary>
/// <param name="Id">
/// The library identifier, such as <c>energylink</c>. The game publishes no symbol for a
/// tool, so this is the key every tool lookup takes.
/// </param>
/// <param name="Name">The display name, such as <c>Energylink</c>.</param>
/// <param name="SuitFamilies">The suit families that carry the tool.</param>
/// <param name="RechargeRate">
/// The energy each second the tool returns to a target, where it recharges one.
/// </param>
/// <param name="DischargeRate">
/// The energy each second the tool draws from a target, where it discharges one.
/// </param>
/// <param name="DischargeDuration">The seconds one discharge lasts.</param>
/// <param name="OverloadPowerUsage">The suit battery one overload spends.</param>
/// <param name="PowerUsage">The suit battery the tool spends each second of use.</param>
/// <param name="ScanDuration">The seconds one scan takes.</param>
/// <param name="CloneDuration">The seconds one clone takes.</param>
/// <remarks>
/// A figure a tool does not have is absent rather than zero: the profile scanner draws no
/// battery over time, and the energylink runs no scan.
/// </remarks>
public sealed record PersonalTool(
    string Id,
    string Name,
    IReadOnlyList<string> SuitFamilies,
    double? RechargeRate = null,
    double? DischargeRate = null,
    double? DischargeDuration = null,
    double? OverloadPowerUsage = null,
    double? PowerUsage = null,
    double? ScanDuration = null,
    double? CloneDuration = null);
