/**
 * Relational Database Query Builder (PostgREST style).
 */
export class TableQueryBuilder<T = Record<string, unknown>> {
  private queryParams: Record<string, string> = {};

  constructor(
    private readonly baseUrl: string,
    private readonly projectSlug: string,
    private readonly table: string,
    private readonly headers: Record<string, string>
  ) {}

  public select(columns = '*'): this {
    this.queryParams['select'] = columns;
    return this;
  }

  public eq(column: string, value: unknown): this {
    this.queryParams[column] = `eq.${value}`;
    return this;
  }

  public neq(column: string, value: unknown): this {
    this.queryParams[column] = `neq.${value}`;
    return this;
  }

  public gt(column: string, value: unknown): this {
    this.queryParams[column] = `gt.${value}`;
    return this;
  }

  public gte(column: string, value: unknown): this {
    this.queryParams[column] = `gte.${value}`;
    return this;
  }

  public lt(column: string, value: unknown): this {
    this.queryParams[column] = `lt.${value}`;
    return this;
  }

  public lte(column: string, value: unknown): this {
    this.queryParams[column] = `lte.${value}`;
    return this;
  }

  public like(column: string, pattern: string): this {
    this.queryParams[column] = `like.${pattern}`;
    return this;
  }

  public ilike(column: string, pattern: string): this {
    this.queryParams[column] = `ilike.${pattern}`;
    return this;
  }

  public in(column: string, values: unknown[]): this {
    this.queryParams[column] = `in.(${values.join(',')})`;
    return this;
  }

  public is(column: string, value: 'null' | 'not_null'): this {
    this.queryParams[column] = `is.${value}`;
    return this;
  }

  public not(column: string, operator: string, value: unknown): this {
    this.queryParams[column] = `not.${operator}.${value}`;
    return this;
  }

  public or(filters: string): this {
    this.queryParams['or'] = filters.startsWith('(') ? filters : `(${filters})`;
    return this;
  }

  public contains(column: string, value: unknown): this {
    this.queryParams[column] = `cs.${typeof value === 'object' ? JSON.stringify(value) : value}`;
    return this;
  }

  public containedBy(column: string, value: unknown): this {
    this.queryParams[column] = `cd.${typeof value === 'object' ? JSON.stringify(value) : value}`;
    return this;
  }

  public textSearch(column: string, query: string): this {
    this.queryParams[column] = `fts.${query}`;
    return this;
  }

  public order(column: string, options?: { ascending?: boolean }): this {
    const dir = options?.ascending === false ? 'desc' : 'asc';
    this.queryParams['order'] = `${column}.${dir}`;
    return this;
  }

  public limit(count: number): this {
    this.queryParams['limit'] = String(count);
    return this;
  }

  public range(from: number, to: number): this {
    this.queryParams['offset'] = String(from);
    this.queryParams['limit'] = String(to - from + 1);
    return this;
  }

  public async count(): Promise<number> {
    const params = { ...this.queryParams, limit: '1' };
    const search = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}/_baas/v1/${this.projectSlug}/rest/${this.table}${search ? `?${search}` : ''}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`Count failed: ${res.status}`);
    const countHeader = res.headers.get('X-Total-Count');
    if (countHeader) return Number(countHeader);
    const rows = (await res.json()) as unknown[];
    return rows.length;
  }

  public async execute(): Promise<T[]> {
    const search = new URLSearchParams(this.queryParams).toString();
    const url = `${this.baseUrl}/_baas/v1/${this.projectSlug}/rest/${this.table}${search ? `?${search}` : ''}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`Query failed: ${res.status}`);
    return (await res.json()) as T[];
  }

  public async single(): Promise<T> {
    const prevLimit = this.queryParams['limit'];
    this.queryParams['limit'] = '2';
    try {
      const rows = await this.execute();
      if (rows.length === 0) {
        throw new Error('JSON object requested, multiple (or no) rows returned');
      }
      if (rows.length > 1) {
        throw new Error('JSON object requested, multiple rows returned');
      }
      return rows[0];
    } finally {
      if (prevLimit !== undefined) {
        this.queryParams['limit'] = prevLimit;
      } else {
        delete this.queryParams['limit'];
      }
    }
  }

  public async maybeSingle(): Promise<T | null> {
    const prevLimit = this.queryParams['limit'];
    this.queryParams['limit'] = '2';
    try {
      const rows = await this.execute();
      if (rows.length === 0) {
        return null;
      }
      if (rows.length > 1) {
        throw new Error('JSON object requested, multiple rows returned');
      }
      return rows[0];
    } finally {
      if (prevLimit !== undefined) {
        this.queryParams['limit'] = prevLimit;
      } else {
        delete this.queryParams['limit'];
      }
    }
  }

  public then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  public async insert(record: Partial<T>): Promise<T> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/rest/${this.table}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error(`Insert failed: ${res.status}`);
    return (await res.json()) as T;
  }

  public async insertMany(records: Partial<T>[], options?: { chunkSize?: number }): Promise<T[]> {
    if (records.length === 0) return [];
    const chunkSize = options?.chunkSize ?? 50;
    const results: T[] = [];

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/rest/${this.table}/batch`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(chunk),
      });
      if (!res.ok) throw new Error(`Batch insert failed: ${res.status}`);
      const inserted = (await res.json()) as T[];
      results.push(...inserted);
    }

    return results;
  }

  public update(patch: Partial<T>) {
    const { baseUrl, projectSlug, table, headers } = this;
    return {
      async match(filter: { id: string | number }): Promise<T> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/rest/${table}/${encodeURIComponent(String(filter.id))}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`Update failed: ${res.status}`);
        return (await res.json()) as T;
      },
    };
  }

  public async upsert(record: Partial<T>, options?: { onConflict?: string }): Promise<T> {
    const conflict = options?.onConflict ?? 'id';
    const res = await fetch(`${this.baseUrl}/_baas/v1/${this.projectSlug}/rest/${this.table}?on_conflict=${conflict}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error(`Upsert failed: ${res.status}`);
    return (await res.json()) as T;
  }

  public delete(rowId?: string | number) {
    const { baseUrl, projectSlug, table, headers } = this;
    if (rowId !== undefined) {
      return (async () => {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/rest/${table}/${encodeURIComponent(String(rowId))}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
        return (await res.json()) as { success: boolean; rowId: string };
      })();
    }
    return {
      async match(filter: { id: string | number }): Promise<{ success: boolean; rowId: string }> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/rest/${table}/${encodeURIComponent(String(filter.id))}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
        return (await res.json()) as { success: boolean; rowId: string };
      },
    };
  }

  /**
   * Real-Time Change Data Capture (CDC) table event listener over Server-Sent Events.
   */
  public on(
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: (payload: { table: string; action: string; payload: unknown; timestamp: string }) => void
  ): () => void {
    if (typeof EventSource === 'undefined') {
      return () => {};
    }

    const url = `${this.baseUrl}/_baas/v1/${this.projectSlug}/db/realtime?table=${encodeURIComponent(this.table)}`;
    const es = new EventSource(url);

    const handler = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        if (event === '*' || parsed.action === event) {
          callback(parsed);
        }
      } catch {
        // Ignore unparseable frames
      }
    };

    if (event === '*') {
      es.onmessage = handler;
      es.addEventListener('INSERT', handler);
      es.addEventListener('UPDATE', handler);
      es.addEventListener('DELETE', handler);
    } else {
      es.addEventListener(event, handler);
    }

    return () => {
      es.close();
    };
  }
}
