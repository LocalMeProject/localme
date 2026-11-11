namespace LocalMe.DataPlane.Auth;

using System;
using System.Numerics;
using System.Security.Cryptography;

/// <summary>
/// Sovereign pure .NET 10 implementation of Ed25519 digital signatures (RFC 8032)
/// with Edwards curve arithmetic over Curve25519 and zero external dependencies.
/// </summary>
public static class Ed25519
{
    private static readonly BigInteger P = BigInteger.Pow(2, 255) - 19;
    private static readonly BigInteger L = BigInteger.Pow(2, 252) + BigInteger.Parse("27742317777372353535851937790883648493", System.Globalization.CultureInfo.InvariantCulture);
    private static readonly BigInteger D = Mod(-121665 * ModInverse(121666, P), P);
    private static readonly BigInteger I = BigInteger.ModPow(2, (P - 1) / 4, P);

    private static readonly Point BasePoint;

    static Ed25519()
    {
        BigInteger y = Mod(4 * ModInverse(5, P), P);
        BigInteger x = RecoverX(y, 0);
        BasePoint = new Point(x, y);
    }

    public sealed record KeyPair(byte[] PublicKey, byte[] PrivateKey);

    public static KeyPair GenerateKeyPair()
    {
        byte[] privateKey = RandomNumberGenerator.GetBytes(32);
        byte[] publicKey = GetPublicKey(privateKey);
        return new KeyPair(publicKey, privateKey);
    }

    public static byte[] GetPublicKey(byte[] privateKeySeed)
    {
        if (privateKeySeed.Length != 32)
        {
            throw new ArgumentException("Private key seed must be exactly 32 bytes.", nameof(privateKeySeed));
        }

        byte[] h = SHA512.HashData(privateKeySeed);
        try
        {
            ClampPrivateKey(h);
            BigInteger a = DecodeScalar(h.AsSpan(0, 32));
            Point aB = ScalarMult(BasePoint, a);
            return EncodePoint(aB);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(h);
        }
    }

    public static byte[] Sign(byte[] privateKeySeed, byte[] message)
    {
        if (privateKeySeed.Length != 32)
        {
            throw new ArgumentException("Private key seed must be exactly 32 bytes.", nameof(privateKeySeed));
        }

        byte[] h = SHA512.HashData(privateKeySeed);
        try
        {
            ClampPrivateKey(h);
            BigInteger a = DecodeScalar(h.AsSpan(0, 32));

            byte[] pubKey = GetPublicKey(privateKeySeed);

            // r = SHA512(h[32..64] || message) mod L
            byte[] rInput = new byte[32 + message.Length];
            Buffer.BlockCopy(h, 32, rInput, 0, 32);
            Buffer.BlockCopy(message, 0, rInput, 32, message.Length);
            byte[] rHash = SHA512.HashData(rInput);
            BigInteger r = Mod(DecodeBigInt(rHash), L);

            Point rB = ScalarMult(BasePoint, r);
            byte[] rEncoded = EncodePoint(rB);

            // k = SHA512(R || A || message) mod L
            byte[] kInput = new byte[32 + 32 + message.Length];
            Buffer.BlockCopy(rEncoded, 0, kInput, 0, 32);
            Buffer.BlockCopy(pubKey, 0, kInput, 32, 32);
            Buffer.BlockCopy(message, 0, kInput, 64, message.Length);
            byte[] kHash = SHA512.HashData(kInput);
            BigInteger k = Mod(DecodeBigInt(kHash), L);

            // S = (r + k * a) mod L
            BigInteger s = Mod(r + k * a, L);
            byte[] sEncoded = EncodeScalar(s);

            byte[] signature = new byte[64];
            Buffer.BlockCopy(rEncoded, 0, signature, 0, 32);
            Buffer.BlockCopy(sEncoded, 0, signature, 32, 32);
            return signature;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(h);
        }
    }

    public static bool Verify(byte[] publicKey, byte[] message, byte[] signature)
    {
        if (publicKey.Length != 32 || signature.Length != 64)
        {
            return false;
        }

        try
        {
            Point? a = DecodePoint(publicKey);
            if (a == null) return false;

            byte[] rBytes = signature[..32];
            byte[] sBytes = signature[32..];

            Point? r = DecodePoint(rBytes);
            if (r == null) return false;

            BigInteger s = DecodeScalar(sBytes);
            if (s >= L) return false;

            // k = SHA512(R || A || message) mod L
            byte[] kInput = new byte[32 + 32 + message.Length];
            Buffer.BlockCopy(rBytes, 0, kInput, 0, 32);
            Buffer.BlockCopy(publicKey, 0, kInput, 32, 32);
            Buffer.BlockCopy(message, 0, kInput, 64, message.Length);
            byte[] kHash = SHA512.HashData(kInput);
            BigInteger k = Mod(DecodeBigInt(kHash), L);

            // Verify: S * B == R + k * A
            Point sb = ScalarMult(BasePoint, s);
            Point ka = ScalarMult(a, k);
            Point rka = AddPoints(r, ka);

            return sb.X == rka.X && sb.Y == rka.Y;
        }
        catch
        {
            return false;
        }
    }

    private sealed record Point(BigInteger X, BigInteger Y);

    private static Point AddPoints(Point p1, Point p2)
    {
        BigInteger x1 = p1.X, y1 = p1.Y;
        BigInteger x2 = p2.X, y2 = p2.Y;

        BigInteger x3Num = Mod(x1 * y2 + y1 * x2, P);
        BigInteger x3Den = Mod(1 + D * x1 * x2 * y1 * y2, P);
        BigInteger x3 = Mod(x3Num * ModInverse(x3Den, P), P);

        BigInteger y3Num = Mod(y1 * y2 + x1 * x2, P);
        BigInteger y3Den = Mod(1 - D * x1 * x2 * y1 * y2, P);
        BigInteger y3 = Mod(y3Num * ModInverse(y3Den, P), P);

        return new Point(x3, y3);
    }

    private static Point ScalarMult(Point p, BigInteger scalar)
    {
        Point result = new Point(0, 1); // Identity point (0, 1)
        Point current = p;

        while (scalar > 0)
        {
            if ((scalar & 1) == 1)
            {
                result = AddPoints(result, current);
            }
            current = AddPoints(current, current);
            scalar >>= 1;
        }

        return result;
    }

    private static BigInteger RecoverX(BigInteger y, int sign)
    {
        if (y >= P) return 0;
        BigInteger x2 = Mod((y * y - 1) * ModInverse(D * y * y + 1, P), P);
        if (x2 == 0) return sign == 1 ? P : 0;

        BigInteger x = BigInteger.ModPow(x2, (P + 3) / 8, P);
        if (Mod(x * x - x2, P) != 0)
        {
            x = Mod(x * I, P);
        }

        if (Mod(x * x - x2, P) != 0)
        {
            throw new CryptographicException("Invalid curve point coordinates.");
        }

        if ((x % 2 == 0 ? 0 : 1) != sign)
        {
            x = P - x;
        }

        return x;
    }

    private static Point? DecodePoint(byte[] bytes)
    {
        if (bytes.Length != 32) return null;
        byte[] copy = (byte[])bytes.Clone();
        int sign = (copy[31] >> 7) & 1;
        copy[31] &= 0x7F;

        BigInteger y = DecodeBigInt(copy);
        if (y >= P) return null;

        try
        {
            BigInteger x = RecoverX(y, sign);
            return new Point(x, y);
        }
        catch
        {
            return null;
        }
    }

    private static byte[] EncodePoint(Point p)
    {
        byte[] bytes = EncodeBigInt(p.Y, 32);
        if (p.X % 2 != 0)
        {
            bytes[31] |= 0x80;
        }
        return bytes;
    }

    private static void ClampPrivateKey(byte[] h)
    {
        h[0] &= 248;
        h[31] &= 127;
        h[31] |= 64;
    }

    private static BigInteger DecodeScalar(ReadOnlySpan<byte> bytes)
    {
        byte[] buf = new byte[bytes.Length + 1];
        bytes.CopyTo(buf);
        return new BigInteger(buf);
    }

    private static BigInteger DecodeBigInt(byte[] bytes)
    {
        byte[] buf = new byte[bytes.Length + 1];
        Buffer.BlockCopy(bytes, 0, buf, 0, bytes.Length);
        return new BigInteger(buf);
    }

    private static byte[] EncodeBigInt(BigInteger val, int length)
    {
        byte[] raw = val.ToByteArray();
        byte[] res = new byte[length];
        int count = Math.Min(raw.Length, length);
        Buffer.BlockCopy(raw, 0, res, 0, count);
        return res;
    }

    private static byte[] EncodeScalar(BigInteger scalar) =>
        EncodeBigInt(scalar, 32);

    private static BigInteger Mod(BigInteger a, BigInteger m)
    {
        BigInteger res = a % m;
        return res < 0 ? res + m : res;
    }

    private static BigInteger ModInverse(BigInteger a, BigInteger m) =>
        BigInteger.ModPow(Mod(a, m), m - 2, m);
}
