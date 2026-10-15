namespace LocalMe.DataPlane.Storage.Adapters;

using System.Security.Cryptography;

/// <summary>
/// Single-node and local development blob storage adapter using a persistent directory path.
/// </summary>
public sealed class LocalDiskAdapter : IBlobStorageAdapter
{
    private readonly string _rootPath;

    public string AdapterKey => "LOCAL_DISK";

    public LocalDiskAdapter(string rootPath)
    {
        _rootPath = rootPath;
        Directory.CreateDirectory(_rootPath);
    }

    private string GetFullPath(string bucket, string objectKey)
    {
        var safeKey = objectKey.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var dir = Path.Combine(_rootPath, bucket, Path.GetDirectoryName(safeKey) ?? string.Empty);
        Directory.CreateDirectory(dir);
        return Path.Combine(_rootPath, bucket, safeKey);
    }

    public async Task PutObjectAsync(
        string bucket,
        string objectKey,
        Stream contentStream,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        var targetPath = GetFullPath(bucket, objectKey);
        await using var fileStream = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.None, 65536, useAsync: true);
        await contentStream.CopyToAsync(fileStream, cancellationToken);
    }

    public Task<Stream?> GetObjectAsync(
        string bucket,
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        var targetPath = GetFullPath(bucket, objectKey);
        if (!File.Exists(targetPath))
        {
            return Task.FromResult<Stream?>(null);
        }

        var stream = new FileStream(targetPath, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, useAsync: true);
        return Task.FromResult<Stream?>(stream);
    }

    public Task<bool> DeleteObjectAsync(
        string bucket,
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        var targetPath = GetFullPath(bucket, objectKey);
        if (!File.Exists(targetPath))
        {
            return Task.FromResult(false);
        }

        File.Delete(targetPath);
        return Task.FromResult(true);
    }

    public Task<BlobMetadata?> HeadObjectAsync(
        string bucket,
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        var targetPath = GetFullPath(bucket, objectKey);
        if (!File.Exists(targetPath))
        {
            return Task.FromResult<BlobMetadata?>(null);
        }

        var fileInfo = new FileInfo(targetPath);
        var metadata = new BlobMetadata(
            Bucket: bucket,
            ObjectKey: objectKey,
            SizeBytes: fileInfo.Length,
            ContentType: "application/octet-stream",
            ETag: $"\"{fileInfo.LastWriteTimeUtc.Ticks}\"",
            LastModified: fileInfo.LastWriteTimeUtc);

        return Task.FromResult<BlobMetadata?>(metadata);
    }

    public Task<string> CreatePresignedPutUrlAsync(
        string bucket,
        string objectKey,
        TimeSpan expiry,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult($"/_baas/v1/storage/object/{bucket}/{objectKey}?sig=local_presigned_put");
    }

    public Task<string> CreatePresignedGetUrlAsync(
        string bucket,
        string objectKey,
        TimeSpan expiry,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult($"/_baas/v1/storage/object/{bucket}/{objectKey}?sig=local_presigned_get");
    }
}
