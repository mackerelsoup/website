import { WEBDAV_PASSWORD, WEBDAV_URL } from "$env/static/private";
import type { PageServerLoad, Actions } from "./$types";
import { listDirectory, moveItem, deleteItem } from "$lib/webdav";
import { redirect } from "@sveltejs/kit";

const WEBDAV_USERNAME: string = 'homelab'

export const actions: Actions = {
  rename: async ({ request }) => {
    const form = await request.formData()
    const path = form.get('path') as string
    const newName = form.get('newName') as string
    const returnPath = form.get('returnPath') as string

    const dir = path.substring(0, path.lastIndexOf('/'))
    const newPath = `${dir}/${newName}`

    console.log("new path: ", newPath)
    console.log("original path:", path)

    await moveItem(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path, newPath)

    throw redirect(303, `/cloud/files?path=${encodeURIComponent(returnPath)}`)
  },

  delete: async ({ request }) => {
    const form = await request.formData()
    const path = form.get('path') as string
    const returnPath = form.get('returnPath') as string

    await deleteItem(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path)

    throw redirect(303, `/cloud/files?path=${encodeURIComponent(returnPath)}`)
  },

}

export const load: PageServerLoad = async ({ url }) => {
  const path = url.searchParams.get('path') ?? '/'

  try {
    const contents = await listDirectory(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path)
    return { files: contents, path }
  } catch {
    return { files: [], path, error: true }
  }
}
