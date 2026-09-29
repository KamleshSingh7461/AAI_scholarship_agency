import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { APP_CONFIG } from '@aci/nest-common';
import type { DocumentConfig } from './config';

/**
 * S3-compatible storage (AWS S3 in production, SeaweedFS locally). The bucket is private;
 * browsers only ever get short-lived presigned URLs.
 */
@Injectable()
export class StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageService.name);
  /** Used for server-side calls (inside docker this is http://seaweedfs:8333). */
  private readonly internal: S3Client;
  /** Used only to sign URLs that the browser will call (http://localhost:9000 or the CDN/S3 host). */
  private readonly publicSigner: S3Client;
  readonly bucket: string;

  constructor(@Inject(APP_CONFIG) private readonly config: DocumentConfig) {
    const e = config.env;
    const base = {
      region: e.S3_REGION,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: e.S3_ACCESS_KEY_ID ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY ?? '' } : undefined,
    };
    this.internal = new S3Client({ ...base, endpoint: e.S3_ENDPOINT || undefined });
    this.publicSigner = new S3Client({ ...base, endpoint: e.S3_PUBLIC_ENDPOINT || e.S3_ENDPOINT || undefined });
    this.bucket = e.S3_BUCKET;
  }

  /** Locally the bucket is created on first start. In production it must be provisioned (with encryption and CORS) up front. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.internal.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      if (this.config.isProd) {
        this.logger.error(`Bucket ${this.bucket} is not reachable: ${(err as Error).name}`);
        return;
      }
      try {
        await this.internal.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created local bucket ${this.bucket}`);
      } catch (e) {
        this.logger.warn(`Could not create bucket ${this.bucket} (is object storage running?): ${(e as Error).message}`);
      }
    }
  }

  /** Browser uploads directly to storage with a POST policy that pins key, type and max size. */
  async presignUpload(key: string, contentType: string, maxBytes: number) {
    return createPresignedPost(this.publicSigner, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: 600,
    });
  }

  async presignDownload(key: string, fileName: string, inline: boolean, expiresIn = 300): Promise<string> {
    const safe = fileName.replace(/[^\w.\- ]/g, '_');
    return getSignedUrl(
      this.publicSigner,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `${inline ? 'inline' : 'attachment'}; filename="${safe}"`,
      }),
      { expiresIn },
    );
  }

  async head(key: string) {
    try {
      return await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      return null;
    }
  }

  /** Reads the first bytes of an object to check its real type (magic numbers), not the claimed one. */
  async readHead(key: string, bytes = 16): Promise<Buffer> {
    const res = await this.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
    const chunks: Buffer[] = [];
    for await (const c of res.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.internal.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: this.config.isProd ? 'AES256' : undefined }),
    );
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const c of res.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.internal.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/** Allowed upload types with their magic-number signatures. */
export const ALLOWED_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'application/pdf': { ext: 'pdf', magic: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { ext: 'webp', magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
};

/** Types the server itself may store (generated reports etc.). */
export const SYSTEM_TYPES = new Set([
  ...Object.keys(ALLOWED_TYPES),
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
