import { WEBDAV_PASSWORD } from "$env/static/private";
import { getClient } from "$lib/webdav";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const WEBDAV_URL = 'https://homelab.tail3fdd8a.ts.net:8443/webdav/'
const WEBDAV_USERNAME = 'homelab'

export const GET: RequestHandler = async ({ url }) => {
  const path = url.searchParams.get('path')
  if (!path) error(400, 'Missing path')

  try {
    const client = getClient(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD)
    const stat = await client.stat(path) as { mime?: string }
    const buffer = await client.getFileContents(path) as ArrayBuffer

    return new Response(buffer, {
      headers: {
        'Content-Type': stat.mime ?? 'application/octet-stream',
        'Content-Disposition': 'inline'
      }
    })
  } catch {
    error(404, 'File not found')
  }
}
