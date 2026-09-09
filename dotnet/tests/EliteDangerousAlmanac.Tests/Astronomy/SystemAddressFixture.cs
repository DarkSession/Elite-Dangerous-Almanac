using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The whole of <c>fixtures/astro/system-addresses.jsonc</c>.</summary>
internal sealed class SystemAddressesFixture
{
    public List<SystemAddressCaseFixture> Systems { get; set; } = [];
}

/// <summary>One verified pair of a system address and the name it writes.</summary>
internal sealed class SystemAddressCaseFixture
{
    public string Id64 { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Region { get; set; } = string.Empty;

    public string L1 { get; set; } = string.Empty;

    public string L2 { get; set; } = string.Empty;

    public string L3 { get; set; } = string.Empty;

    public string MassCode { get; set; } = string.Empty;

    public int N1 { get; set; }

    public int N2 { get; set; }
}
