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

export async function deleteItem(url: string, username: string, password: string, path: string): Promise<void> {
  const client = getClient(url, username, password);
  await client.deleteFile(path);
}

export async function moveItem(url: string, username: string, password: string, from: string, to: string): Promise<void> {
  const client = getClient(url, username, password);
  await client.moveFile(from, to);
}

export async function createDirectory(url: string, username: string, password: string, path: string): Promise<void> {
  const client = getClient(url, username, password);
  await client.createDirectory(path, { recursive: true });
}

export async function exists(url: string, username: string, password: string, path: string): Promise<boolean> {
  const client = getClient(url, username, password);
  return client.exists(path);
}
