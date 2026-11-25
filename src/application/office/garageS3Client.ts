import { refineClient } from '../refine/client.ts';

export interface GarageClusterInfo {
  endpoint: string;
  region: string;
  mode: string;
  s3Sdk?: string;
  externalS3Connected?: boolean;
}

export interface GarageBucketSummary {
  id: string;
  name: string;
  region: string;
  visibility: string;
  quotaMb: number;
  endpoint: string;
  objectCount?: number;
  usedBytes?: number;
}

export interface GarageObjectSummary {
  id: string;
  bucketId: string;
  bucketName: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  etag: string;
  versionNumber: number;
  linkedEntityType: string;
  linkedEntityId: string | null;
  createdBy: string;
  updatedAt: string;
}

export interface GarageObjectPreviewResponse {
  object: GarageObjectSummary;
  preview: {
    mode: 'image' | 'pdf' | 'text' | 'ooxml' | 'binary';
    textContent: string | null;
    truncated: boolean;
    lineCount: number;
    linkedDocumentId: string | null;
    downloadPath: string;
    inlinePath: string;
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Не удалось прочитать файл ${file.name}`));
    reader.readAsDataURL(file);
  });
}

class GarageS3Client {
  async listBucketObjects(
    bucketName: string,
    options?: { prefix?: string; q?: string }
  ): Promise<{
    cluster: GarageClusterInfo;
    bucket: GarageBucketSummary;
    objects: GarageObjectSummary[];
  }> {
    const params = new URLSearchParams();
    if (options?.prefix) params.set('prefix', options.prefix);
    if (options?.q) params.set('q', options.q);
    const qs = params.toString();
    return refineClient.request(
      `/api/office/garage/buckets/${encodeURIComponent(bucketName)}/objects${qs ? `?${qs}` : ''}`
    );
  }

  async createBucket(input: {
    name: string;
    visibility?: 'private' | 'tenant-read';
    quotaMb?: number;
  }): Promise<{ bucket: GarageBucketSummary }> {
    return refineClient.request('/api/office/garage/buckets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async uploadFile(params: {
    bucketName: string;
    prefix?: string;
    file: File;
  }): Promise<{ object: GarageObjectSummary }> {
    const base64Content = await readFileAsDataUrl(params.file);
    return refineClient.request('/api/office/garage/objects/upload', {
      method: 'POST',
      body: JSON.stringify({
        bucketName: params.bucketName,
        prefix: params.prefix || '',
        fileName: params.file.name,
        contentType: params.file.type || 'application/octet-stream',
        base64Content,
      }),
    });
  }

  async getObjectPreview(objectId: string): Promise<GarageObjectPreviewResponse> {
    return refineClient.request(`/api/office/garage/objects/${encodeURIComponent(objectId)}/preview`);
  }

  async fetchObjectBlobUrl(objectId: string, inline = true): Promise<string> {
    const headers = new Headers();
    headers.set('X-Tenant-Subdomain', refineClient.getSubdomain());
    const token = refineClient.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const suffix = inline ? '?disposition=inline' : '';
    const res = await fetch(`/api/office/garage/objects/${encodeURIComponent(objectId)}/download${suffix}`, {
      headers,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error((errData as { error?: string }).error || 'Не удалось загрузить файл из Garage S3');
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async downloadObject(objectId: string, fileName: string): Promise<void> {
    return refineClient.downloadBlob(
      `/api/office/garage/objects/${encodeURIComponent(objectId)}/download`,
      fileName
    );
  }

  async deleteObject(objectId: string): Promise<{ deleted: boolean }> {
    return refineClient.request(`/api/office/garage/objects/${encodeURIComponent(objectId)}`, {
      method: 'DELETE',
    });
  }
}

export const garageS3Client = new GarageS3Client();
