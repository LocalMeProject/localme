namespace LocalMe.Integration.Tests;

using System.Text;
using LocalMe.DataPlane.Storage.Adapters;
using Xunit;

public sealed class StorageAdapterTests
{
    [Fact]
    public async Task LocalDiskAdapter_Put_Get_Delete_Roundtrip_Succeeds()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "localme-storage-test-" + Guid.NewGuid());
        var adapter = new LocalDiskAdapter(tempDir);

        try
        {
            var bucket = "test-bucket";
            var objectKey = "documents/test.txt";
            var content = "LocalMe Sovereign BaaS Blob Storage Payload";
            var bytes = Encoding.UTF8.GetBytes(content);

            // 1. Put Object
            using (var putStream = new MemoryStream(bytes))
            {
                await adapter.PutObjectAsync(bucket, objectKey, putStream, "text/plain");
            }

            // 2. Head Object
            var metadata = await adapter.HeadObjectAsync(bucket, objectKey);
            Assert.NotNull(metadata);
            Assert.Equal(bytes.Length, metadata.SizeBytes);

            // 3. Get Object
            await using (var getStream = await adapter.GetObjectAsync(bucket, objectKey))
            {
                Assert.NotNull(getStream);
                using var reader = new StreamReader(getStream, Encoding.UTF8);
                var downloaded = await reader.ReadToEndAsync();
                Assert.Equal(content, downloaded);
            }

            // 4. Delete Object
            var deleted = await adapter.DeleteObjectAsync(bucket, objectKey);
            Assert.True(deleted);

            // 5. Verify Not Found
            var postDelete = await adapter.GetObjectAsync(bucket, objectKey);
            Assert.Null(postDelete);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                Directory.Delete(tempDir, recursive: true);
            }
        }
    }
}
