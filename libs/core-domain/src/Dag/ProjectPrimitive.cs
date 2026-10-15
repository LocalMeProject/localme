namespace LocalMe.Core.Dag;

/// <summary>
/// Represents an allocated internal infrastructure primitive with reference counting.
/// </summary>
public sealed class ProjectPrimitive
{
    public Guid ProjectId { get; }
    public PrimitiveCode Primitive { get; }
    public int RefCount { get; private set; }
    public PrimitiveState State { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public ProjectPrimitive(Guid projectId, PrimitiveCode primitive, int refCount = 1, PrimitiveState state = PrimitiveState.PENDING)
    {
        if (refCount < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(refCount), "Reference count cannot be negative.");
        }

        ProjectId = projectId;
        Primitive = primitive;
        RefCount = refCount;
        State = state;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void IncrementRef()
    {
        RefCount++;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public bool DecrementRef()
    {
        if (RefCount <= 0)
        {
            throw new InvalidOperationException($"Cannot decrement ref count on primitive {Primitive} when already {RefCount}.");
        }

        RefCount--;
        UpdatedAt = DateTimeOffset.UtcNow;

        if (RefCount == 0)
        {
            State = PrimitiveState.DEPROVISIONING;
            return true; // signals eligible for deprovisioning
        }

        return false;
    }

    public void TransitionState(PrimitiveState newState)
    {
        State = newState;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
