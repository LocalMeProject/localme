namespace LocalMe.DataPlane.Storage.Adapters;

using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// S3-compatible Blob Adapter targeting Runflare.com and S3-compliant object storage.
/// </summary>
public sealed class RunflareBlobAdapter : IBlobStorageAdapter
{
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromMinutes(5) };
    private readonly string _endpoint;
    private readonly string _accessKey;
    private readonly string _secretKey;

    public string AdapterKey => "RUNFLARE_BLOB";

    public RunflareBlobAdapter(string endpoint, string accessKey, string secretKey)
    {
        _endpoint = endpoint.TrimEnd('/');
        _accessKey = accessKey;
        _secretKey = secretKey;
    }

    private string BuildUrl(string bucket, string objectKey) =>
        $"{_endpoint}/{bucket.Trim('/')}/{objectKey.TrimStart('/')}";

    public async Task PutObjectAsync(string bucket, string objectKey, Stream contentStream, string contentType, CancellationToken cancellationToken = default)
    {
        var url = BuildUrl(bucket, objectKey);
        using var request = new HttpRequestMessage(HttpMethod.Put, url);
        using var content = new StreamContent(contentStream);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        request.Content = content;

        SignRequest(request);

        var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task<Stream?> GetObjectAsync(string bucket, string objectKey, CancellationToken cancellationToken = default)
    {
        var url = BuildUrl(bucket, objectKey);
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        SignRequest(request);

        var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStreamAsync(cancellationToken);
    }

    public async Task<bool> DeleteObjectAsync(string bucket, string objectKey, CancellationToken cancellationToken = default)
    {
        var url = BuildUrl(bucket, objectKey);
        using var request = new HttpRequestMessage(HttpMethod.Delete, url);
        SignRequest(request);

        var response = await _http.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    public async Task<BlobMetadata?> HeadObjectAsync(string bucket, string objectKey, CancellationToken cancellationToken = default)
    {
        var url = BuildUrl(bucket, objectKey);
        using var request = new HttpRequestMessage(HttpMethod.Head, url);
        SignRequest(request);

        var response = await _http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        var length = response.Content.Headers.ContentLength ?? 0;
        var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
        var etag = response.Headers.ETag?.Tag ?? $"\"{Guid.NewGuid():N}\"";
        var lastModified = response.Content.Headers.LastModified?.UtcDateTime ?? DateTime.UtcNow;

        return new BlobMetadata(bucket, objectKey, length, contentType, etag, lastModified);
    }

    public Task<string> CreatePresignedPutUrlAsync(string bucket, string objectKey, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        var url = BuildUrl(bucket, objectKey);
        var expiresUnix = DateTimeOffset.UtcNow.Add(expiry).ToUnixTimeSeconds();
        return Task.FromResult($"{url}?X-Amz-Expires={expiry.TotalSeconds}&X-Amz-Date={expiresUnix}&X-Amz-Credential={Uri.EscapeDataString(_accessKey)}");
    }

    public Task<string> CreatePresignedGetUrlAsync(string bucket, string objectKey, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        var url = BuildUrl(bucket, objectKey);
        var expiresUnix = DateTimeOffset.UtcNow.Add(expiry).ToUnixTimeSeconds();
        return Task.FromResult($"{url}?X-Amz-Expires={expiry.TotalSeconds}&X-Amz-Date={expiresUnix}&X-Amz-Credential={Uri.EscapeDataString(_accessKey)}");
    }

    private void SignRequest(HttpRequestMessage request)
    {
        if (!string.IsNullOrWhiteSpace(_accessKey))
        {
            request.Headers.TryAddWithoutValidation("X-Amz-Access-Key", _accessKey);
            request.Headers.Date = DateTimeOffset.UtcNow;
            if (!string.IsNullOrWhiteSpace(_secretKey))
            {
                var sigInput = $"{request.Method}\n{request.RequestUri?.AbsolutePath}\n{request.Headers.Date:R}";
                using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
                var hash = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(sigInput)));
                request.Headers.TryAddWithoutValidation("Authorization", $"AWS {_accessKey}:{hash}");
            }
        }
    }
}
