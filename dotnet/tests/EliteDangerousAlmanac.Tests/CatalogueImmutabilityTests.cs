using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using EliteDangerousAlmanac.Internal;
using Xunit;

namespace EliteDangerousAlmanac.Tests;

/// <summary>
/// Every published catalogue is a process-wide singleton shared by every caller, so none
/// of them may be changed. One caller's mutation would otherwise change another caller's
/// lookups.
/// </summary>
/// <remarks>
/// The test discovers the catalogues rather than listing them, so a new feature area is
/// covered the day it lands.
/// </remarks>
public class CatalogueImmutabilityTests
{
    public static TheoryData<string> Catalogues()
    {
        TheoryData<string> data = [];
        foreach (PropertyInfo property in CatalogueProperties())
        {
            data.Add($"{property.DeclaringType!.FullName}.{property.Name}");
        }

        return data;
    }

    [Fact]
    public void TheAssemblyPublishesCatalogues() => Assert.NotEmpty(CatalogueProperties());

    [Theory]
    [MemberData(nameof(Catalogues))]
    public void CatalogueRefusesEveryChange(string name)
    {
        PropertyInfo property = CatalogueProperties()
            .Single(candidate => $"{candidate.DeclaringType!.FullName}.{candidate.Name}" == name);
        object value = property.GetValue(null)
            ?? throw new InvalidOperationException($"{name} is null.");

        if (value is IList list)
        {
            Assert.True(list.IsReadOnly, $"{name} accepts a change.");
            Assert.Throws<NotSupportedException>(() => list.Add(list[0]));
        }
        else if (value is IDictionary dictionary)
        {
            Assert.True(dictionary.IsReadOnly, $"{name} accepts a change.");
        }
        else
        {
            Assert.Fail($"{name} is neither a list nor a dictionary.");
        }
    }

    [Fact]
    public void ACatalogueLoadsOnceAndAnswersTheSameInstance()
    {
        foreach (PropertyInfo property in CatalogueProperties())
        {
            Assert.Same(property.GetValue(null), property.GetValue(null));
        }
    }

    private static IReadOnlyList<PropertyInfo> CatalogueProperties()
    {
        Assembly library = typeof(SharedData).GetTypeInfo().Assembly;
        List<PropertyInfo> properties = [];
        foreach (Type type in library.GetExportedTypes())
        {
            foreach (PropertyInfo property in type.GetProperties(BindingFlags.Public | BindingFlags.Static))
            {
                if (IsCatalogue(property.PropertyType)) properties.Add(property);
            }
        }

        properties.Sort((left, right) => string.CompareOrdinal(
            $"{left.DeclaringType!.FullName}.{left.Name}",
            $"{right.DeclaringType!.FullName}.{right.Name}"));
        return properties;
    }

    private static bool IsCatalogue(Type type)
    {
        if (!type.IsGenericType) return false;
        Type definition = type.GetGenericTypeDefinition();
        return definition == typeof(IReadOnlyList<>) || definition == typeof(IReadOnlyDictionary<,>);
    }
}
