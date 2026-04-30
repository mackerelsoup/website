import { WEBDAV_PASSWORD } from "$env/static/private";
import type { PageServerLoad } from "./$types";
import { getClient } from "$lib/webdav";
import { redirect, isRedirect } from "@sveltejs/kit";

const WEBDAV_URL: string = 'https://homelab.tail3fdd8a.ts.net:8443/webdav/'
const WEBDAV_USERNAME: string = 'homelab'

export const load: PageServerLoad = async () => {
  try {
    const client = getClient(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD);
    await client.exists('/'); // throws if unreachable
    redirect(302, '/cloud/files'); // only reached if online
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { isOnline: false };
  }
};
