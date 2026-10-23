namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public sealed partial class ProjectManagerService
{
    // 5. Project Users (SMS OTP, Email/Password, OAuth)
    public IReadOnlyList<ProjectAuthUser> GetProjectUsers(string projectId) =>
        _projectUsers.TryGetValue(projectId, out var users) ? users : [];

    public ProjectAuthUser AddProjectUser(
        string projectId,
        string? phone = null,
        string? email = null,
        string? fullName = null,
        string provider = "sms_otp",
        string? username = null,
        string? password = null)
    {
        var list = _projectUsers.GetOrAdd(projectId, _ => []);
        string? passwordHash = !string.IsNullOrWhiteSpace(password)
            ? HashPassword(password)
            : null;

        var user = new ProjectAuthUser(
            Id: $"usr_{Guid.NewGuid():N}"[..10],
            Phone: string.IsNullOrWhiteSpace(phone) ? null : phone.Trim(),
            Email: string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant(),
            FullName: fullName?.Trim(),
            Provider: provider,
            IsConfirmed: true,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            LastSignInUtc: DateTimeOffset.UtcNow,
            Username: string.IsNullOrWhiteSpace(username) ? null : username.Trim().ToLowerInvariant(),
            PasswordHash: passwordHash
        );
        list.Insert(0, user);

        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveProjectAuthUserAsync(projectId, user); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] SaveProjectAuthUser error: {ex.Message}"); }
            });
        }

        return user;
    }

    public bool DeleteProjectUser(string projectId, string userId)
    {
        if (!_projectUsers.TryGetValue(projectId, out var list)) return false;
        var idx = list.FindIndex(u => u.Id == userId);
        if (idx >= 0)
        {
            list.RemoveAt(idx);
            if (_store != null)
            {
                _ = Task.Run(async () =>
                {
                    try { await _store.DeleteProjectAuthUserAsync(projectId, userId); }
                    catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteProjectAuthUser error: {ex.Message}"); }
                });
            }
            return true;
        }
        return false;
    }

    public ProjectAuthUser? UpdateProjectUserStatus(string projectId, string userId, bool isConfirmed)
    {
        if (!_projectUsers.TryGetValue(projectId, out var list)) return null;
        var idx = list.FindIndex(u => u.Id == userId);
        if (idx < 0) return null;
        var cur = list[idx];
        var updated = cur with { IsConfirmed = isConfirmed };
        list[idx] = updated;
        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveProjectAuthUserAsync(projectId, updated); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] UpdateProjectUserStatus error: {ex.Message}"); }
            });
        }
        return updated;
    }

    public ProjectAuthUser? ResetProjectUserPassword(string projectId, string userId, string newPassword)
    {
        if (!_projectUsers.TryGetValue(projectId, out var list)) return null;
        var idx = list.FindIndex(u => u.Id == userId);
        if (idx < 0) return null;
        var cur = list[idx];
        var updated = cur with { PasswordHash = HashPassword(newPassword) };
        list[idx] = updated;
        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveProjectAuthUserAsync(projectId, updated); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] ResetProjectUserPassword error: {ex.Message}"); }
            });
        }
        return updated;
    }

    public ProjectAuthUser? FindProjectUser(string projectId, string identifier)
    {
        if (!_projectUsers.TryGetValue(projectId, out var list)) return null;
        var query = identifier.Trim().ToLowerInvariant();
        return list.FirstOrDefault(u =>
            (u.Email != null && u.Email.Equals(query, StringComparison.OrdinalIgnoreCase)) ||
            (u.Phone != null && u.Phone.Equals(query, StringComparison.OrdinalIgnoreCase)) ||
            (u.Username != null && u.Username.Equals(query, StringComparison.OrdinalIgnoreCase)));
    }

}
