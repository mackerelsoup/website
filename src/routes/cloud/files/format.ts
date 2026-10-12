/** Pure display helpers for the Miller-columns file browser. */

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let i = 0;
	while (value >= 1024 && i < units.length - 1) {
		value /= 1024;
		i++;
	}
	return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2h ago` for the last 24h, `Mon DD` otherwise. `now` is injectable for tests. */
export function formatModified(lastmod: string, now = Date.now()): string {
	const t = new Date(lastmod).getTime();
	if (Number.isNaN(t)) return '—';
	const diff = now - t;
	if (diff >= 0 && diff < 60_000) return 'just now';
	if (diff >= 0 && diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff >= 0 && diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	const d = new Date(t);
	return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
}

/** Strips the last path segment. */
export function parentPath(path: string): string {
	const parts = path.replace(/\/$/, '').split('/');
	parts.pop();
	return parts.join('/') || '/';
}

/** Splits a `width`-cell bar into filled/empty runs, e.g. for `▕████░░░░▏`. */
export function barCells(percent: number, width: number): { filled: number; empty: number } {
	const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
	return { filled, empty: width - filled };
}

export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '—';
	if (seconds < 60) return `${Math.ceil(seconds)}s`;
	const m = Math.floor(seconds / 60);
	return m < 60 ? `${m}m ${Math.round(seconds % 60)}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i;
export const isImage = (name: string) => IMAGE_EXT.test(name);
