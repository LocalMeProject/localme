namespace LocalMe.Core.Finance;

using System.Globalization;

/// <summary>
/// Strictly immutable Iranian Rial (IRR) double-entry currency value object.
/// Operates exclusively on signed/unsigned 64-bit integer values (BIGINT).
/// Toman is strictly a presentation-layer projection.
/// </summary>
public readonly struct RialAmount : IEquatable<RialAmount>, IComparable<RialAmount>
{
    public long AmountIrr { get; }

    public static readonly RialAmount Zero = new(0);

    public RialAmount(long amountIrr)
    {
        AmountIrr = amountIrr;
    }

    public static RialAmount FromToman(long toman)
    {
        return new RialAmount(checked(toman * 10));
    }

    public long ToToman()
    {
        return AmountIrr / 10;
    }

    public string ToRialString()
    {
        return $"{AmountIrr.ToString("N0", CultureInfo.InvariantCulture)} IRR";
    }

    public string ToTomanString()
    {
        var toman = ToToman();
        return $"{toman.ToString("N0", CultureInfo.InvariantCulture)} تومان";
    }

    public static RialAmount operator +(RialAmount a, RialAmount b)
    {
        return new RialAmount(checked(a.AmountIrr + b.AmountIrr));
    }

    public static RialAmount operator -(RialAmount a, RialAmount b)
    {
        return new RialAmount(checked(a.AmountIrr - b.AmountIrr));
    }

    public static bool operator >(RialAmount a, RialAmount b) => a.AmountIrr > b.AmountIrr;
    public static bool operator <(RialAmount a, RialAmount b) => a.AmountIrr < b.AmountIrr;
    public static bool operator >=(RialAmount a, RialAmount b) => a.AmountIrr >= b.AmountIrr;
    public static bool operator <=(RialAmount a, RialAmount b) => a.AmountIrr <= b.AmountIrr;
    public static bool operator ==(RialAmount a, RialAmount b) => a.AmountIrr == b.AmountIrr;
    public static bool operator !=(RialAmount a, RialAmount b) => a.AmountIrr != b.AmountIrr;

    public bool Equals(RialAmount other) => AmountIrr == other.AmountIrr;
    public override bool Equals(object? obj) => obj is RialAmount other && Equals(other);
    public override int GetHashCode() => AmountIrr.GetHashCode();
    public int CompareTo(RialAmount other) => AmountIrr.CompareTo(other.AmountIrr);

    public override string ToString() => ToRialString();
}
