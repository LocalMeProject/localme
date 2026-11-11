async function handleFetchError(res: Response, defaultMsg: string): Promise<never> {
  let errBody: Record<string, unknown> | null = null;
  try {
    errBody = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore
  }
  const msg = (errBody?.error as string) || (errBody?.detail as string) || (errBody?.message as string) || `${defaultMsg}: ${res.status}`;
  const error = new Error(msg) as Error & { status?: number; code?: string; detail?: string; error?: unknown; responseBody?: unknown };
  error.status = res.status;
  error.code = errBody?.code as string | undefined;
  error.detail = errBody?.detail as string | undefined;
  error.error = errBody?.error ?? errBody;
  error.responseBody = errBody;
  throw error;
}

/**
 * Relational Database Query Builder (PostgREST style).
 */
export class TableQueryBuilder<T = Record<string, unknown>> {
  private queryParams: Array<[string, string]> = [];

  constructor(
    private readonly baseUrl: string,
    private readonly projectSlug: string,
    private readonly table: string,
    private readonly headers: Record<string, string>
  ) {}

  private setOrAppendParam(key: string, value: string, replace = false): void {
    if (replace) {
      this.queryParams = this.queryParams.filter(([k]) => k !== key);
    }
    this.queryParams.push([key, value]);
  }

  public select(columns = '*'): this {
    this.setOrAppendParam('select', columns, true);
    return this;
  }

  public eq(column: string, value: unknown): this {
    this.queryParams.push([column, `eq.${value}`]);
    return this;
  }

  public neq(column: string, value: unknown): this {
    this.queryParams.push([column, `neq.${value}`]);
    return this;
  }

  public gt(column: string, value: unknown): this {
    this.queryParams.push([column, `gt.${value}`]);
    return this;
  }

  public gte(column: string, value: unknown): this {
    this.queryParams.push([column, `gte.${value}`]);
    return this;
  }

  public lt(column: string, value: unknown): this {
    this.queryParams.push([column, `lt.${value}`]);
    return this;
  }

  public lte(column: string, value: unknown): this {
    this.queryParams.push([column, `lte.${value}`]);
    return this;
  }

  public like(column: string, pattern: string): this {
    this.queryParams.push([column, `like.${pattern}`]);
    return this;
  }

  public ilike(column: string, pattern: string): this {
    this.queryParams.push([column, `ilike.${pattern}`]);
    return this;
  }

  public in(column: string, values: unknown[]): this {
    this.queryParams.push([column, `in.(${values.join(',')})`]);
    return this;
  }

  public is(column: string, value: 'null' | 'not_null'): this {
    this.queryParams.push([column, `is.${value}`]);
    return this;
  }

  public not(column: string, operator: string, value: unknown): this {
    this.queryParams.push([column, `not.${operator}.${value}`]);
    return this;
  }

  public or(filters: string): this {
    this.queryParams.push(['or', filters.startsWith('(') ? filters : `(${filters})`]);
    return this;
  }

  public contains(column: string, value: unknown): this {
    this.queryParams.push([column, `cs.${typeof value === 'object' ? JSON.stringify(value) : value}`]);
    return this;
  }

  public containedBy(column: string, value: unknown): this {
    this.queryParams.push([column, `cd.${typeof value === 'object' ? JSON.stringify(value) : value}`]);
    return this;
  }

  public textSearch(column: string, query: string): this {
    this.queryParams.push([column, `fts.${query}`]);
    return this;
  }

  public order(column: string, options?: { ascending?: boolean }): this {
    const dir = options?.ascending === false ? 'desc' : 'asc';
    this.setOrAppendParam('order', `${column}.${dir}`, true);
    return this;
  }

  public limit(count: number): this {
    this.setOrAppendParam('limit', String(count), true);
    return this;
  }

  public range(from: number, to: number): this {
    this.setOrAppendParam('offset', String(from), true);
    this.setOrAppendParam('limit', String(to - from + 1), true);
    return this;
  }

  private buildQueryString(extra?: Array<[string, string]>): string {
    const params = new URLSearchParams();
    for (const [k, v] of this.queryParams) {
      params.append(k, v);
    }
    if (extra) {
      for (const [k, v] of extra) {
        params.append(k, v);
      }
    }
    const q = params.toString();
    return q ? `?${q}` : '';
  }

  public async count(): Promise<number> {
    const search = this.buildQueryString([['limit', '1']]);
    const url = `${this.baseUrl}/_baas/v1/${this.projectSlug}/rest/${this.table}${search}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) await handleFetchError(res, 'Count failed');
    const countHeader = res.headers.get('X-Total-Count');
    if (countHeader) return Number(countHeader);
    const rows = (await res.json()) as unknown[];
    return rows.length;
  }

  public async execute(): Promise<T[]> {
    const search = this.buildQueryString();
    const url = `${this.baseUrl}/_baas/v1/${this.projectSlug}/rest/${this.table}${search}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) await handleFetchError(res, 'Query failed');
    return (await res.json()) as T[];
  }

  public async single(): Promise<T> {
    const search = this.buildQueryString([['limit', '2']]);
    const url = `${this.baseUrl}/_baas/v1/${this.projectSlug}/rest/${this.table}${search}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) await handleFetchError(res, 'Query failed');
    const rows = (await res.json()) as T[];
    if (rows.length === 0) {
      throw new Error('JSON object requested, multiple (or no) rows returned');
    }
    if (rows.length > 1) {
      throw new Error('JSON object requested, multiple rows returned');
    }
    return rows[0];
  }

  public async maybeSingle(): Promise<T | null> {
    const search = this.buildQueryString([['limit', '2']]);
    const url = `${this.baseUrl}/_baas/v1/${this.projectSlug}/rest/${this.table}${search}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) await handleFetchError(res, 'Query failed');
    const rows = (await res.json()) as T[];
    if (rows.length === 0) {
      return null;
    }
    if (rows.length > 1) {
      throw new Error('JSON object requested, multiple rows returned');
    }
    return rows[0];
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
    if (!res.ok) await handleFetchError(res, 'Insert failed');
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
      if (!res.ok) await handleFetchError(res, 'Batch insert failed');
      const inserted = (await res.json()) as T[];
      results.push(...inserted);
    }

    return results;
  }

  public update(patch: Partial<T>) {
    const { baseUrl, projectSlug, table, headers } = this;
    return {
      async match(filter: Record<string, unknown> | { id: string | number }): Promise<T> {
        const rowId = 'id' in filter ? filter.id : Object.values(filter)[0];
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/rest/${table}/${encodeURIComponent(String(rowId))}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(patch),
        });
        if (!res.ok) await handleFetchError(res, 'Update failed');
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
    if (!res.ok) await handleFetchError(res, 'Upsert failed');
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
        if (!res.ok) await handleFetchError(res, 'Delete failed');
        return (await res.json()) as { success: boolean; rowId: string };
      })();
    }
    return {
      async match(filter: Record<string, unknown> | { id: string | number }): Promise<{ success: boolean; rowId: string }> {
        const targetId = 'id' in filter ? filter.id : Object.values(filter)[0];
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/rest/${table}/${encodeURIComponent(String(targetId))}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) await handleFetchError(res, 'Delete failed');
        return (await res.json()) as { success: boolean; rowId: string };
      },
    };
  }
}

