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

    /// <summary>
    /// Walks a catalogue to its leaves and finds a collection any caller could write to.
    /// </summary>
    /// <remarks>
    /// Reading only the published collection proves the outer shell alone. A record inside
    /// it can still hand out the very dictionary the catalogue holds, which lets one caller
    /// write a value every later caller reads. The walk therefore follows every public
    /// property and field of every value it reaches.
    /// </remarks>
    [Theory]
    [MemberData(nameof(Catalogues))]
    public void NothingInsideACatalogueAcceptsAChange(string name)
    {
        PropertyInfo property = CatalogueProperties()
            .Single(candidate => $"{candidate.DeclaringType!.FullName}.{candidate.Name}" == name);
        object? value = property.GetValue(null);

        HashSet<object> seen = new(ReferenceEqualityComparer.Instance);
        List<string> writable = [];
        Walk(value, name, seen, writable, 0);

        Assert.True(writable.Count == 0, string.Join(Environment.NewLine, writable));
    }

    /// <summary>Follows one value to its leaves, noting every collection that accepts a change.</summary>
    private static void Walk(object? value, string path, HashSet<object> seen, List<string> writable, int depth)
    {
        // Eight levels reaches the deepest record any catalogue holds, and stops a graph that
        // turns back on itself from running away.
        if (value is null || depth > 8) return;

        Type type = value.GetType();
        if (type.IsPrimitive || value is string || value is decimal || type.IsEnum) return;
        if (!seen.Add(value)) return;

        if (value is IEnumerable items)
        {
            if (IsWritable(value)) writable.Add($"{path} accepts a change.");
            int index = 0;
            foreach (object? item in items)
            {
                Walk(item, $"{path}[{index}]", seen, writable, depth + 1);
                if (++index >= 64) break;
            }

            return;
        }

        foreach (PropertyInfo member in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (member.GetIndexParameters().Length > 0 || !member.CanRead) continue;
            Walk(Read(() => member.GetValue(value)), $"{path}.{member.Name}", seen, writable, depth + 1);
        }

        foreach (FieldInfo member in type.GetFields(BindingFlags.Public | BindingFlags.Instance))
        {
            Walk(Read(() => member.GetValue(value)), $"{path}.{member.Name}", seen, writable, depth + 1);
        }
    }

    /// <summary>Reads one member, answering nothing where reading it raises.</summary>
    /// <remarks>
    /// A property is free to refuse a read, such as one that raises for a record that
    /// carries no such figure. That is not a change the catalogue accepts.
    /// </remarks>
    private static object? Read(Func<object?> read)
    {
        try
        {
            return read();
        }
        catch (TargetInvocationException)
        {
            return null;
        }
    }

    /// <summary>Whether a caller can write to one collection, through any interface it carries.</summary>
    private static bool IsWritable(object value) => value switch
    {
        IDictionary dictionary => !dictionary.IsReadOnly,
        IList list => !list.IsReadOnly,
        _ => WritableThroughGenerics(value),
    };

    /// <summary>
    /// Whether a collection accepts a change through a generic interface, where the
    /// non-generic ones say nothing.
    /// </summary>
    /// <remarks>
    /// A <c>Dictionary&lt;TKey, TValue&gt;</c> whose key is not an object still carries
    /// <c>ICollection&lt;T&gt;</c>, and its <c>IsReadOnly</c> is the honest answer.
    /// </remarks>
    private static bool WritableThroughGenerics(object value)
    {
        foreach (Type contract in value.GetType().GetInterfaces())
        {
            if (!contract.IsGenericType) continue;
            if (contract.GetGenericTypeDefinition() != typeof(ICollection<>)) continue;

            PropertyInfo? readOnly = contract.GetProperty("IsReadOnly");
            if (readOnly?.GetValue(value) is false) return true;
        }

        return false;
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
