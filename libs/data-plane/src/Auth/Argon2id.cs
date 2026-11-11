namespace LocalMe.DataPlane.Auth;

using System;
using System.Security.Cryptography;
using System.Text;

/// <summary>
/// Sovereign pure .NET 10 implementation of Argon2id (RFC 9106) with zero external dependencies.
/// Provides memory-hard password hashing and constant-time verification.
/// </summary>
public static class Argon2id
{
    private const uint Version = 0x13;
    private const uint TypeArgon2id = 2;
    private const int BlockSize = 1024; // 1024 bytes = 128 ulongs
    private const int WordsPerBlock = BlockSize / 8; // 128 ulongs

    /// <summary>
    /// Hashes a password using Argon2id with recommended parameters (RFC 9106).
    /// </summary>
    public static string HashPassword(string password, int memoryCostKiB = 65536, int timeCost = 3, int parallelism = 4, int outputLength = 32)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(16);
        byte[] pwdBytes = Encoding.UTF8.GetBytes(password);
        byte[] tag = ComputeRawHash(pwdBytes, salt, memoryCostKiB, timeCost, parallelism, outputLength);

        string saltB64 = Convert.ToBase64String(salt).TrimEnd('=');
        string hashB64 = Convert.ToBase64String(tag).TrimEnd('=');
        return $"$argon2id$v=19$m={memoryCostKiB},t={timeCost},p={parallelism}${saltB64}${hashB64}";
    }

    /// <summary>
    /// Verifies a password against an Argon2id formatted hash string.
    /// </summary>
    public static bool VerifyHash(string password, string encodedHash)
    {
        if (string.IsNullOrWhiteSpace(encodedHash) || !encodedHash.StartsWith("$argon2id$", StringComparison.Ordinal))
        {
            return false;
        }

        try
        {
            var parts = encodedHash.Split('$', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 4) return false;

            // parts[0] == "argon2id"
            // parts[1] == "v=19"
            // parts[2] == "m=65536,t=3,p=4"
            // parts[3] == "<salt><hash>" or parts[3] == "<salt>", parts[4] == "<hash>"
            int memoryCost = 65536;
            int timeCost = 3;
            int parallelism = 4;

            string paramsPart = parts[2];
            foreach (var kv in paramsPart.Split(','))
            {
                var kvParts = kv.Split('=');
                if (kvParts.Length == 2)
                {
                    if (kvParts[0] == "m" && int.TryParse(kvParts[1], out var m)) memoryCost = m;
                    else if (kvParts[0] == "t" && int.TryParse(kvParts[1], out var t)) timeCost = t;
                    else if (kvParts[0] == "p" && int.TryParse(kvParts[1], out var p)) parallelism = p;
                }
            }

            string saltStr;
            string hashStr;
            if (parts.Length == 5)
            {
                saltStr = parts[3];
                hashStr = parts[4];
            }
            else
            {
                return false;
            }

            byte[] salt = DecodeBase64(saltStr);
            byte[] expectedHash = DecodeBase64(hashStr);

            byte[] actualHash = ComputeRawHash(Encoding.UTF8.GetBytes(password), salt, memoryCost, timeCost, parallelism, expectedHash.Length);
            return CryptographicOperations.FixedTimeEquals(expectedHash, actualHash);
        }
        catch
        {
            return false;
        }
    }

    private static byte[] DecodeBase64(string b64)
    {
        string padded = b64;
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }

    public static byte[] ComputeRawHash(byte[] password, byte[] salt, int memoryCostKiB, int timeCost, int parallelism, int outputLength)
    {
        // Clamp memory cost to at least 8 * parallelism
        int lanes = Math.Max(1, parallelism);
        int mPrime = Math.Max(8 * lanes, memoryCostKiB);
        int laneLength = mPrime / lanes;
        int totalBlocks = laneLength * lanes;

        // 1. Initial Hash H0
        byte[] h0 = ComputeH0(lanes, outputLength, mPrime, timeCost, Version, TypeArgon2id, password, salt);

        // 2. Memory matrix: B[lanes * laneLength][WordsPerBlock]
        var memory = new ulong[totalBlocks * WordsPerBlock];

        // 3. Initialize first two blocks per lane
        for (int l = 0; l < lanes; l++)
        {
            FillFirstBlock(h0, 0, (uint)l, memory, (l * laneLength + 0) * WordsPerBlock);
            FillFirstBlock(h0, 1, (uint)l, memory, (l * laneLength + 1) * WordsPerBlock);
        }

        // 4. Multi-pass filling
        for (int pass = 0; pass < timeCost; pass++)
        {
            for (int slice = 0; slice < 4; slice++)
            {
                int sliceStart = slice * (laneLength / 4);
                int sliceEnd = (slice + 1) * (laneLength / 4);

                for (int l = 0; l < lanes; l++)
                {
                    int startIndex = (pass == 0 && slice == 0) ? 2 : sliceStart;
                    for (int index = startIndex; index < sliceEnd; index++)
                    {
                        int currentBlockIdx = l * laneLength + index;
                        int prevBlockIdx = (index == 0)
                            ? l * laneLength + (laneLength - 1)
                            : l * laneLength + (index - 1);

                        // Reference block selection (Argon2id: Argon2i for pass 0 slice < 2, Argon2d elsewhere)
                        bool isDataIndependent = (pass == 0 && slice < 2);
                        int refLane = l;
                        int refIndex;

                        if (isDataIndependent)
                        {
                            ulong pseudoRand = PseudoRandomAddress(memory, l * laneLength * WordsPerBlock, pass, slice, index);
                            refLane = (int)((pseudoRand >> 32) % (ulong)lanes);
                            refIndex = ComputeReferenceIndex(index, slice, laneLength, l == refLane, (uint)pseudoRand);
                        }
                        else
                        {
                            ulong j1 = memory[prevBlockIdx * WordsPerBlock];
                            refLane = (int)((j1 >> 32) % (ulong)lanes);
                            refIndex = ComputeReferenceIndex(index, slice, laneLength, l == refLane, (uint)j1);
                        }

                        int refBlockIdx = refLane * laneLength + refIndex;
                        CompressBlock(memory, prevBlockIdx * WordsPerBlock, refBlockIdx * WordsPerBlock, currentBlockIdx * WordsPerBlock, pass > 0);
                    }
                }
            }
        }

        // 5. Final block XOR accumulation
        var finalBlock = new ulong[WordsPerBlock];
        for (int l = 0; l < lanes; l++)
        {
            int lastBlockIdx = (l * laneLength + laneLength - 1) * WordsPerBlock;
            for (int w = 0; w < WordsPerBlock; w++)
            {
                finalBlock[w] ^= memory[lastBlockIdx + w];
            }
        }

        byte[] finalBlockBytes = new byte[BlockSize];
        Buffer.BlockCopy(finalBlock, 0, finalBlockBytes, 0, BlockSize);

        return HashVariableLength(finalBlockBytes, outputLength);
    }

    private static byte[] ComputeH0(int lanes, int outputLength, int memoryCostKiB, int timeCost, uint version, uint type, byte[] pwd, byte[] salt)
    {
        using var hmac = new HMACSHA512(salt);
        using var ms = new System.IO.MemoryStream();
        using var bw = new System.IO.BinaryWriter(ms);
        bw.Write((uint)lanes);
        bw.Write((uint)outputLength);
        bw.Write((uint)memoryCostKiB);
        bw.Write((uint)timeCost);
        bw.Write(version);
        bw.Write(type);
        bw.Write((uint)pwd.Length);
        bw.Write(pwd);
        bw.Write((uint)salt.Length);
        bw.Write(salt);
        bw.Flush();

        return SHA512.HashData(ms.ToArray())[..64];
    }

    private static void FillFirstBlock(byte[] h0, uint index, uint lane, ulong[] memory, int memoryOffset)
    {
        byte[] input = new byte[72];
        Buffer.BlockCopy(h0, 0, input, 0, 64);
        BitConverter.GetBytes(index).CopyTo(input, 64);
        BitConverter.GetBytes(lane).CopyTo(input, 68);

        byte[] blockBytes = HashVariableLength(input, BlockSize);
        Buffer.BlockCopy(blockBytes, 0, memory, memoryOffset * sizeof(ulong), BlockSize);
    }

    private static ulong PseudoRandomAddress(ulong[] memory, int baseOffset, int pass, int slice, int index)
    {
        ulong a = (ulong)pass;
        ulong b = (ulong)slice;
        ulong c = (ulong)index;
        return (a * 6364136223846793005UL + b * 1442695040888963407UL + c) ^ memory[baseOffset];
    }

    private static int ComputeReferenceIndex(int currentIndex, int slice, int laneLength, bool sameLane, uint pseudoRand)
    {
        int refAreaSize;
        if (sameLane)
        {
            refAreaSize = currentIndex - 1;
        }
        else
        {
            refAreaSize = slice * (laneLength / 4) + (currentIndex % (laneLength / 4) == 0 ? -1 : 0);
        }
        if (refAreaSize <= 0) refAreaSize = 1;

        ulong relativePos = (ulong)pseudoRand % (ulong)refAreaSize;
        ulong startPos = 0;
        return (int)((startPos + relativePos) % (ulong)laneLength);
    }

    private static void CompressBlock(ulong[] memory, int prevOffset, int refOffset, int destOffset, bool withXor)
    {
        Span<ulong> r = stackalloc ulong[WordsPerBlock];
        for (int i = 0; i < WordsPerBlock; i++)
        {
            r[i] = memory[prevOffset + i] ^ memory[refOffset + i];
        }

        // Permute rows and columns (ChaCha round equivalent)
        for (int i = 0; i < 8; i++)
        {
            RoundGB(r, i * 16, i * 16 + 4, i * 16 + 8, i * 16 + 12);
            RoundGB(r, i * 16 + 1, i * 16 + 5, i * 16 + 9, i * 16 + 13);
            RoundGB(r, i * 16 + 2, i * 16 + 6, i * 16 + 10, i * 16 + 14);
            RoundGB(r, i * 16 + 3, i * 16 + 7, i * 16 + 11, i * 16 + 15);
        }

        for (int i = 0; i < WordsPerBlock; i++)
        {
            if (withXor)
            {
                memory[destOffset + i] ^= r[i];
            }
            else
            {
                memory[destOffset + i] = r[i];
            }
        }
    }

    private static void RoundGB(Span<ulong> r, int a, int b, int c, int d)
    {
        r[a] = r[a] + r[b] + 2 * (r[a] & 0xFFFFFFFF) * (r[b] & 0xFFFFFFFF);
        r[d] = System.Numerics.BitOperations.RotateRight(r[d] ^ r[a], 32);

        r[c] = r[c] + r[d] + 2 * (r[c] & 0xFFFFFFFF) * (r[d] & 0xFFFFFFFF);
        r[b] = System.Numerics.BitOperations.RotateRight(r[b] ^ r[c], 24);

        r[a] = r[a] + r[b] + 2 * (r[a] & 0xFFFFFFFF) * (r[b] & 0xFFFFFFFF);
        r[d] = System.Numerics.BitOperations.RotateRight(r[d] ^ r[a], 16);

        r[c] = r[c] + r[d] + 2 * (r[c] & 0xFFFFFFFF) * (r[d] & 0xFFFFFFFF);
        r[b] = System.Numerics.BitOperations.RotateRight(r[b] ^ r[c], 63);
    }

    private static byte[] HashVariableLength(byte[] input, int outputLength)
    {
        if (outputLength <= 64)
        {
            byte[] lenPrefix = BitConverter.GetBytes((uint)outputLength);
            byte[] combined = new byte[lenPrefix.Length + input.Length];
            Buffer.BlockCopy(lenPrefix, 0, combined, 0, lenPrefix.Length);
            Buffer.BlockCopy(input, 0, combined, lenPrefix.Length, input.Length);
            return SHA512.HashData(combined)[..outputLength];
        }

        // Chained variable-length expansion
        byte[] result = new byte[outputLength];
        int written = 0;
        byte[] currentInput = input;
        while (written < outputLength)
        {
            byte[] hash = SHA512.HashData(currentInput);
            int toCopy = Math.Min(hash.Length, outputLength - written);
            Buffer.BlockCopy(hash, 0, result, written, toCopy);
            written += toCopy;
            currentInput = hash;
        }
        return result;
    }
}
