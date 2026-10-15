namespace LocalMe.Core.Tests;

using LocalMe.Core.Finance;
using Xunit;

public sealed class RialAmountTests
{
    [Fact]
    public void Rial_To_Toman_Division_Is_Accurate()
    {
        var amount = new RialAmount(1_000_000); // 1,000,000 Rials = 100,000 Tomans
        Assert.Equal(100_000, amount.ToToman());
        Assert.Equal("100,000 تومان", amount.ToTomanString());
        Assert.Equal("1,000,000 IRR", amount.ToRialString());
    }

    [Fact]
    public void FromToman_Multiplies_By_Ten()
    {
        var amount = RialAmount.FromToman(50_000);
        Assert.Equal(500_000, amount.AmountIrr);
    }

    [Fact]
    public void Addition_And_Subtraction_Are_Exact()
    {
        var a = new RialAmount(500_000);
        var b = new RialAmount(250_000);

        Assert.Equal(new RialAmount(750_000), a + b);
        Assert.Equal(new RialAmount(250_000), a - b);
    }

    [Fact]
    public void Comparison_Operators_Work_Correctly()
    {
        var smaller = new RialAmount(100);
        var larger = new RialAmount(200);

        Assert.True(larger > smaller);
        Assert.True(smaller < larger);
        Assert.False(smaller == larger);
        Assert.True(smaller != larger);
    }
}
