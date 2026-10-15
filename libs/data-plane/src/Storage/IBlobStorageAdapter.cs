namespace LocalMe.DataPlane.Storage;

/// <summary>
/// Universal blob storage adapter contract (Section 0.2 Directive 4 & ADR-0004).
/// Guarantees portability across Runflare, Arvan, ParsPack, MinIO, S3, R2, and LocalDisk.
/// </summary>
public interface IBlobStorageAdapter
{
    string AdapterKey { get; }

    Task PutObjectAsync(
        string bucket,
        string objectKey,
        Stream contentStream,
        string contentType,
        CancellationToken cancellationToken = default);

    Task<Stream?> GetObjectAsync(
        string bucket,
        string objectKey,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteObjectAsync(
        string bucket,
        string objectKey,
        CancellationToken cancellationToken = default);

    Task<BlobMetadata?> HeadObjectAsync(
        string bucket,
        string objectKey,
        CancellationToken cancellationToken = default);

    Task<string> CreatePresignedPutUrlAsync(
        string bucket,
        string objectKey,
        TimeSpan expiry,
        CancellationToken cancellationToken = default);

    Task<string> CreatePresignedGetUrlAsync(
        string bucket,
        string objectKey,
        TimeSpan expiry,
        CancellationToken cancellationToken = default);
}

public sealed record BlobMetadata(
    string Bucket,
    string ObjectKey,
    long SizeBytes,
    string ContentType,
    string ETag,
    DateTimeOffset LastModified);
