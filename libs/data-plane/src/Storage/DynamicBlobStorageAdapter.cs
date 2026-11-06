namespace LocalMe.DataPlane.Storage;

using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.Storage.Adapters;

/// <summary>
/// Composite, zero-restart dynamic blob storage adapter. Automatically delegates
/// storage calls to LocalDisk or AbrArvan S3 based on live in-DB platform configuration.
/// </summary>
public sealed class DynamicBlobStorageAdapter : IBlobStorageAdapter
{
    private readonly PlatformConfigurationService _configService;
    private readonly LocalDiskAdapter _localDiskFallback;
    private volatile ArvanS3BlobAdapter? _cachedS3Adapter;
    private string? _cachedEndpoint;
    private string? _cachedAccessKey;
    private string? _cachedSecretKey;

    public DynamicBlobStorageAdapter(PlatformConfigurationService configService, LocalDiskAdapter localDiskFallback)
    {
        _configService = configService ?? throw new ArgumentNullException(nameof(configService));
        _localDiskFallback = localDiskFallback ?? throw new ArgumentNullException(nameof(localDiskFallback));
    }

    public string AdapterKey => GetActiveAdapter().AdapterKey;

    public IBlobStorageAdapter GetActiveAdapter()
    {
        var cfg = _configService.GetConfig();
        var type = cfg.StorageAdapterType?.ToUpperInvariant() ?? "LOCAL_DISK";

        if (type == "ARVAN_S3" || type == "S3_COMPATIBLE")
        {
            if (!string.IsNullOrWhiteSpace(cfg.ArvanS3Endpoint) && !string.IsNullOrWhiteSpace(cfg.ArvanS3AccessKey))
            {
                var ep = cfg.ArvanS3Endpoint;
                var ak = cfg.ArvanS3AccessKey;
                var sk = cfg.ArvanS3SecretKey;

                if (_cachedS3Adapter == null ||
                    _cachedEndpoint != ep ||
                    _cachedAccessKey != ak ||
                    _cachedSecretKey != sk)
                {
                    _cachedEndpoint = ep;
                    _cachedAccessKey = ak;
                    _cachedSecretKey = sk;
                    _cachedS3Adapter = new ArvanS3BlobAdapter(
                        ep,
                        ak,
                        sk,
                        cfg.ArvanS3Region,
                        cfg.ArvanS3CdnUrl
                    );
                }
                return _cachedS3Adapter;
            }
        }

        return _localDiskFallback;
    }

    public Task PutObjectAsync(string bucket, string objectKey, Stream contentStream, string contentType, CancellationToken cancellationToken = default) =>
        GetActiveAdapter().PutObjectAsync(bucket, objectKey, contentStream, contentType, cancellationToken);

    public Task<Stream?> GetObjectAsync(string bucket, string objectKey, CancellationToken cancellationToken = default) =>
        GetActiveAdapter().GetObjectAsync(bucket, objectKey, cancellationToken);

    public Task<bool> DeleteObjectAsync(string bucket, string objectKey, CancellationToken cancellationToken = default) =>
        GetActiveAdapter().DeleteObjectAsync(bucket, objectKey, cancellationToken);

    public Task<BlobMetadata?> HeadObjectAsync(string bucket, string objectKey, CancellationToken cancellationToken = default) =>
        GetActiveAdapter().HeadObjectAsync(bucket, objectKey, cancellationToken);

    public Task<string> CreatePresignedPutUrlAsync(string bucket, string objectKey, TimeSpan expiry, CancellationToken cancellationToken = default) =>
        GetActiveAdapter().CreatePresignedPutUrlAsync(bucket, objectKey, expiry, cancellationToken);

    public Task<string> CreatePresignedGetUrlAsync(string bucket, string objectKey, TimeSpan expiry, CancellationToken cancellationToken = default) =>
        GetActiveAdapter().CreatePresignedGetUrlAsync(bucket, objectKey, expiry, cancellationToken);
}
