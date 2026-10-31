import type {
  SqlExecutionResult,
  TableIndexDefinition,
  TableRelationshipDefinition,
  TablePolicyDefinition,
  DatabaseSnapshotMeta,
} from './types';

/**
 * Sovereign DBaaS Administrative & DDL Client.
 */
export class DatabaseClient {
  constructor(
    private readonly baseUrl: string,
    private readonly projectSlug: string,
    private readonly headers: Record<string, string>
  ) {}

  public async listTables(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables`, { headers: this.headers });
    if (!res.ok) throw new Error(`List tables failed: ${res.status}`);
    return (await res.json()) as string[];
  }

  public async createTable(name: string): Promise<{ success: boolean; table: string }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Create table failed: ${res.status}`);
    return (await res.json()) as { success: boolean; table: string };
  }

  public async deleteTable(table: string): Promise<{ success: boolean; table: string }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Delete table failed: ${res.status}`);
    return (await res.json()) as { success: boolean; table: string };
  }

  public async getSchema(table = 'products'): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/schema?table=${encodeURIComponent(table)}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Get schema failed: ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  public async executeSql<T = unknown>(sql: string): Promise<SqlExecutionResult<T>> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/sql/execute`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ sql }),
    });
    if (!res.ok) throw new Error(`Execute SQL failed: ${res.status}`);
    return (await res.json()) as SqlExecutionResult<T>;
  }

  public async truncateTable(table: string): Promise<{ success: boolean; table: string }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/truncate`, {
      method: 'POST',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Truncate table failed: ${res.status}`);
    return (await res.json()) as { success: boolean; table: string };
  }

  public async getIndexes(table: string): Promise<TableIndexDefinition[]> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/indexes`, { headers: this.headers });
    if (!res.ok) throw new Error(`Get indexes failed: ${res.status}`);
    return (await res.json()) as TableIndexDefinition[];
  }

  public async createIndex(table: string, options: { name?: string; columns: string[]; isUnique?: boolean }): Promise<{ success: boolean; index: string }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/indexes`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error(`Create index failed: ${res.status}`);
    return (await res.json()) as { success: boolean; index: string };
  }

  public async deleteIndex(table: string, indexName: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/indexes/${encodeURIComponent(indexName)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Delete index failed: ${res.status}`);
    return (await res.json()) as { success: boolean };
  }

  public async rebuildIndex(table: string, indexName: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/indexes/${encodeURIComponent(indexName)}/rebuild`, {
      method: 'POST',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Rebuild index failed: ${res.status}`);
    return (await res.json()) as { success: boolean };
  }

  public async getRelationships(table: string): Promise<TableRelationshipDefinition[]> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/relationships`, { headers: this.headers });
    if (!res.ok) throw new Error(`Get relationships failed: ${res.status}`);
    return (await res.json()) as TableRelationshipDefinition[];
  }

  public async createRelationship(table: string, options: { sourceColumn: string; targetTable: string; targetColumn?: string; onDelete?: string; onUpdate?: string; constraintName?: string }): Promise<{ success: boolean; relationship: TableRelationshipDefinition }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/relationships`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error(`Create relationship failed: ${res.status}`);
    return (await res.json()) as { success: boolean; relationship: TableRelationshipDefinition };
  }

  public async deleteRelationship(table: string, constraintName: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/relationships/${encodeURIComponent(constraintName)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Delete relationship failed: ${res.status}`);
    return (await res.json()) as { success: boolean };
  }

  public async getPolicies(table: string): Promise<TablePolicyDefinition[]> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/policies`, { headers: this.headers });
    if (!res.ok) throw new Error(`Get policies failed: ${res.status}`);
    return (await res.json()) as TablePolicyDefinition[];
  }

  public async createPolicy(table: string, options: { name: string; command?: string; roles?: string; usingExpression?: string; checkExpression?: string }): Promise<{ success: boolean; policy: string }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/policies`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error(`Create policy failed: ${res.status}`);
    return (await res.json()) as { success: boolean; policy: string };
  }

  public async deletePolicy(table: string, policyName: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/tables/${encodeURIComponent(table)}/policies/${encodeURIComponent(policyName)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Delete policy failed: ${res.status}`);
    return (await res.json()) as { success: boolean };
  }

  public async listSnapshots(): Promise<DatabaseSnapshotMeta[]> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/snapshots`, { headers: this.headers });
    if (!res.ok) throw new Error(`List snapshots failed: ${res.status}`);
    return (await res.json()) as DatabaseSnapshotMeta[];
  }

  public async createSnapshot(type = 'دستی فوری'): Promise<{ success: boolean; snapshot: DatabaseSnapshotMeta }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/snapshots`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ type }),
    });
    if (!res.ok) throw new Error(`Create snapshot failed: ${res.status}`);
    return (await res.json()) as { success: boolean; snapshot: DatabaseSnapshotMeta };
  }

  public async restoreSnapshot(snapshotId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/snapshots/${encodeURIComponent(snapshotId)}/restore`, {
      method: 'POST',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Restore snapshot failed: ${res.status}`);
    return (await res.json()) as { success: boolean; message: string };
  }

  public async deleteSnapshot(snapshotId: string): Promise<{ success: boolean; snapshotId: string }> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/db/snapshots/${encodeURIComponent(snapshotId)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Delete snapshot failed: ${res.status}`);
    return (await res.json()) as { success: boolean; snapshotId: string };
  }
}
