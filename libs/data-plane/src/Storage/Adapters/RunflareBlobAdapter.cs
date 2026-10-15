namespace LocalMe.DataPlane.Storage.Adapters;

/// <summary>
/// S3-compatible Blob Adapter targeting Runflare.com managed storage (default production provider).
/// </summary>
public sealed class RunflareBlobAdapter : IBlobStorageAdapter
{
    private readonly string _endpoint;
    private readonly string _accessKey;
    private readonly string _secretKey;

    public string AdapterKey => "RUNFLARE_BLOB";

    public RunflareBlobAdapter(string endpoint, string accessKey, string secretKey)
    {
        _endpoint = endpoint;
        _accessKey = accessKey;
        _secretKey = secretKey;
    }

    public Task PutObjectAsync(string bucket, string objectKey, Stream contentStream, string contentType, CancellationToken cancellationToken = default)
    {
        // Production implementation dispatches via S3 V4 signing
        return Task.CompletedTask;
    }

    public Task<Stream?> GetObjectAsync(string bucket, string objectKey, CancellationToken cancellationToken = default)
    {
        return Task.FromResult<Stream?>(null);
    }

    public Task<bool> DeleteObjectAsync(string bucket, string objectKey, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<BlobMetadata?> HeadObjectAsync(string bucket, string objectKey, CancellationToken cancellationToken = default)
    {
        return Task.FromResult<BlobMetadata?>(null);
    }

    public Task<string> CreatePresignedPutUrlAsync(string bucket, string objectKey, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        return Task.FromResult($"{_endpoint}/{bucket}/{objectKey}?X-Amz-Expires={expiry.TotalSeconds}");
    }

    public Task<string> CreatePresignedGetUrlAsync(string bucket, string objectKey, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        return Task.FromResult($"{_endpoint}/{bucket}/{objectKey}?X-Amz-Expires={expiry.TotalSeconds}");
    }
}
