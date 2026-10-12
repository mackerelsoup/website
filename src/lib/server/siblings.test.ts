import { test, expect } from 'bun:test';
import { visibleSiblings } from './siblings';

const dir = (n: string) => ({ basename: n, filename: `/${n}`, type: 'directory' as const });
const file = (n: string) => ({ basename: n, filename: `/${n}`, type: 'file' as const });
const current = { basename: 'b', filename: '/b' };

test('drops siblings the identity has no Grant on', async () => {
	const out = await visibleSiblings([dir('a'), dir('b'), dir('secret')], current, async (p) => p !== '/secret');
	expect(out.map((s) => s.basename)).toEqual(['a', 'b']);
});

test('drops files', async () => {
	const out = await visibleSiblings([file('x.txt'), dir('b')], current, async () => true);
	expect(out.map((s) => s.basename)).toEqual(['b']);
});

test('always includes the current Folder, even when the parent listing omits it', async () => {
	const out = await visibleSiblings([dir('secret')], current, async () => false);
	expect(out).toEqual([current]);
});
