import { WEBDAV_PASSWORD, WEBDAV_URL } from "$env/static/private";
import type { PageServerLoad } from "./$types";
import { getClient } from "$lib/webdav";
import { redirect, isRedirect } from "@sveltejs/kit";

const WEBDAV_USERNAME: string = 'homelab'

export const load: PageServerLoad = async () => {
  try {
    console.log('[cloud] connecting to WebDAV:', WEBDAV_URL);
    const client = getClient(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD);
    await client.exists('/');
    console.log('[cloud] WebDAV reachable, redirecting');
    redirect(302, '/cloud/files');
  } catch (e) {
    if (isRedirect(e)) throw e;
    console.error('[cloud] WebDAV unreachable:', e);
    return { isOnline: false };
  }
};
