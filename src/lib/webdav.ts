import { PassThrough, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createClient, type FileStat, type WebDAVClient } from "webdav";

export function getClient(url: string, username: string, password: string): WebDAVClient {
  return createClient(url, { username, password });
}

export async function listDirectory(url: string, username: string, password: string, path: string): Promise<FileStat[]> {
  const client = getClient(url, username, password);
  return client.getDirectoryContents(path) as Promise<FileStat[]>;
}

export async function readFile(url: string, username: string, password: string, path: string): Promise<string> {
  const client = getClient(url, username, password);
  return client.getFileContents(path, { format: "text" }) as Promise<string>;
}

export async function writeFileStream(
  url: string, username: string, password: string, path: string, content: Readable,
  onProgress?: (bytesWritten: number) => void
): Promise<void> {
  const client = getClient(url, username, password);
  let uploadStream: Readable = content;
  let pipelineDone: Promise<void> | undefined;

  if (onProgress) {
    const tracker = new PassThrough();
    let written = 0;
    tracker.on('data', (chunk: Buffer) => {
      written += chunk.length;
      onProgress(written);
    });
    // pipeline (unlike .pipe()) forwards errors from `content` to `tracker` and
    // destroys both sides, so a read failure surfaces instead of hanging forever.
    pipelineDone = pipeline(content, tracker);
    uploadStream = tracker;
  }

  const putDone = client.putFileContents(path, uploadStream, { overwrite: true });
  await (pipelineDone ? Promise.all([putDone, pipelineDone]) : putDone);
}

export async function deleteItem(url: string, username: string, password: string, path: string, isDirectory = false): Promise<void> {
  const client = getClient(url, username, password);
  const target = isDirectory && !path.endsWith('/') ? `${path}/` : path
  await client.deleteFile(target);
}

export async function moveItem(url: string, username: string, password: string, from: string, to: string, isDirectory = false): Promise<void> {
  const fromPath = isDirectory && !from.endsWith('/') ? `${from}/` : from;
  const toPath = isDirectory && !to.endsWith('/') ? `${to}/` : to;

  const base = url.replace(/\/$/, ''); // strip trailing slash from WEBDAV_URL
  const destBase = base.replace(/^https:/, 'http:'); // Apache expects http:// internally

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const res = await fetch(`${base}${fromPath}`, {
    method: 'MOVE',
    headers: {
      Authorization: `Basic ${auth}`,
      Destination: `${destBase}${toPath}`,
      Overwrite: 'F'
    }
  });

  if (!res.ok) {
    throw new Error(`Move failed: ${res.status} ${res.statusText}`);
  }
}

export async function createDirectory(url: string, username: string, password: string, path: string): Promise<void> {
  const client = getClient(url, username, password);
  await client.createDirectory(path, { recursive: true });
}

export async function exists(url: string, username: string, password: string, path: string): Promise<boolean> {
  const client = getClient(url, username, password);
  return client.exists(path);
  
}
