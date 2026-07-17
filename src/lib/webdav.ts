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

export async function writeFile(url: string, username: string, password: string, path: string, content: string | Buffer): Promise<void> {
  const client = getClient(url, username, password);
  await client.putFileContents(path, content, { overwrite: true });
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
