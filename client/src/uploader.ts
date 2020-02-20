import S3 from 'aws-sdk/clients/s3';
import { DEFAULT_BASE_URL, fetchOptions } from './constants';

interface PrepareResponse {
  s3Options: S3.Types.ClientConfiguration;
  bucketName: string;
  objectKey: string;
  signature: string;
}

export interface FinalizeResponse {
  id?: string;
  name: string;
  signature?: string;

  value: string;
}

export interface UploadResult extends FinalizeResponse {
  state: 'aborted' | 'successful' | 'error';
  msg: string;
  error?: Error;
}

export declare type EProgressState = 'initial' | 'uploading' | 'preparing' | 'finishing' | 'done' | 'aborted';

export interface UploadOptions {
  baseUrl: string;
  onProgress(progress: {
    percentage: number;
    loaded: number;
    total: number;
    state: EProgressState;
  }): void;
  abortSignal(onAbort: () => void): void;
}

// the percent reserved for upload initiate and finalize operations
const OVERHEAD_PERCENT = 0.05;


function fileInfo(result: FinalizeResponse, file: File): string {
  return JSON.stringify({
    name: result.name,
    size: file.size,
    id: result.id,
    signature: result.signature
  });
}

async function fetchJson(...args: Parameters<typeof fetch>): Promise<any> {
  const resp = await fetch(...args);
  if(!resp.ok) {
    const text = await resp.text();
    throw new Error(`Server returned ${resp.status} error: ${text}`);
  }
  return resp.json();
}

export async function uploadFile(file: File, options: Partial<UploadOptions> = {}): Promise<UploadResult> {
  const { onProgress, baseUrl, abortSignal } = Object.assign({
    onProgress: () => undefined,
    baseUrl: DEFAULT_BASE_URL,
    abortSignal: () => undefined
  } as UploadOptions, options);

  const size = file.size;
  const progress = (
      state: EProgressState,
      percentage: number,
      loaded = 0,
      total = size,
  ): void => {
    onProgress({
      percentage,
      loaded,
      total,
      state
    });
  };

  progress('preparing', 0);

  let initUpload: PrepareResponse;
  try {
    initUpload = await fetchJson(`${baseUrl}/upload-prepare/`, {
      ...fetchOptions(),
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
      }),
    }) as PrepareResponse;

    progress('uploading', OVERHEAD_PERCENT / 2);
  } catch (err) {
    return {
      id: undefined,
      name: file.name,
      state: 'error',
      msg: 'Failed to prepare upload token',
      error: err,
      value: ''
    }
  }

  const s3 = new S3({
    ...initUpload.s3Options
  });

  const task = s3.upload({
    Bucket: initUpload.bucketName,
    Key: initUpload.objectKey,
    Body: file,
  });

  task.on('httpUploadProgress', (evt): void => {
    const s3Progress = evt.loaded / evt.total;
    // s3Progress only spans the total fileProgress range [0.05, 0.9)
    progress('uploading', OVERHEAD_PERCENT / 2 + s3Progress * (1 - OVERHEAD_PERCENT), evt.loaded, evt.total);
  });



  async function finalizeUpload(status: 'uploaded' | 'aborted' = 'uploaded'): Promise<FinalizeResponse> {
    return fetchJson(`${baseUrl}/upload-finalize/`, {
      ...fetchOptions(),
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        id: initUpload.objectKey,
        status,
        signature: initUpload.signature
      }),
    }) as Promise<FinalizeResponse>;
  }

  return new Promise<UploadResult>((resolve) => {
    abortSignal(() => {
      task.abort();
      progress('finishing', 1);
      finalizeUpload('aborted').then((r) => {
        progress('aborted', 1);
        return {
          ...r,
          state: 'aborted',
          msg: 'Upload aborted',
        } as UploadResult;
      }).then(resolve).catch((error) => {
        resolve({
          name: file.name,
          state: 'error',
          msg: 'Error occurred while aborting the upload',
          error,
          value: ''
        });
      });
    });

    task.promise().then(() => {
      progress('finishing', 1, size);
      finalizeUpload().then((r) => {
        progress('done', 1, size);
        return {
          ...r,
          state: 'successful',
          value: fileInfo(r, file)
        } as UploadResult;
      }).then(resolve).catch((error) => {
        resolve({
          name: file.name,
          state: 'error',
          msg: 'Error occurred while finishing the upload',
          error,
          value: ''
        });
      }).catch((error) => {
        resolve({
          name: file.name,
          state: 'error',
          msg: 'Error occurred while uploading',
          error,
          value: ''
        });
      });
    });
  });
}
