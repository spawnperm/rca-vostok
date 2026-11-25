import type { PermissionCode } from '../../domain/iam/rbac.ts';
import type { AuthenticatedActor, TenantContext } from '../../domain/shared/types.ts';

class RefinePortalClient {
  private token: string | null = null;
  private subdomain = 'acme';

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  setSubdomain(subdomain: string) {
    this.subdomain = subdomain;
  }

  getSubdomain(): string {
    return this.subdomain;
  }

  private buildHeaders(initHeaders?: HeadersInit, hasJsonBody?: boolean): Headers {
    const headers = new Headers(initHeaders);
    headers.set('X-Tenant-Subdomain', this.subdomain);
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    if (hasJsonBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = this.buildHeaders(init.headers, Boolean(init.body));
    const res = await fetch(path, { ...init, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    return data as T;
  }

  triggerBlobDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  downloadJson(data: unknown, fileName: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json; charset=utf-8',
    });
    this.triggerBlobDownload(blob, fileName);
  }

  downloadText(content: string, fileName: string, mimeType = 'text/plain; charset=utf-8'): void {
    const blob = new Blob([content], { type: mimeType });
    this.triggerBlobDownload(blob, fileName);
  }

  async downloadBlob(path: string, fallbackFileName: string): Promise<void> {
    const headers = this.buildHeaders();
    const res = await fetch(path, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error((errData as { error?: string }).error || 'Не удалось скачать файл');
    }
    const blob = await res.blob();
    this.triggerBlobDownload(blob, fallbackFileName);
  }

  async getList<T>(resource: string): Promise<T> {
    return this.request<T>(`/api/${resource}`);
  }

  async create<T>(resource: string, variables: unknown): Promise<T> {
    return this.request<T>(`/api/${resource}`, {
      method: 'POST',
      body: JSON.stringify(variables),
    });
  }

  async update<T>(resource: string, id: string, variables: unknown): Promise<T> {
    return this.request<T>(`/api/${resource}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(variables),
    });
  }

  async deleteOne<T>(resource: string, id: string): Promise<T> {
    return this.request<T>(`/api/${resource}/${id}`, {
      method: 'DELETE',
    });
  }

  can(actor: AuthenticatedActor | null, permission: PermissionCode): boolean {
    if (!actor) return false;
    return actor.permissions.includes(permission);
  }
}

export const refineClient = new RefinePortalClient();

export interface DemoAccountSummary {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  roleName: string;
  roleCode: string;
  tenantId: string;
  tenantSubdomain: string;
}

export interface PortalBootstrapState {
  actor: AuthenticatedActor;
  tenant: TenantContext;
}
