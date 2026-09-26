import { test, expect } from 'bun:test';
import { isAdminRoute, isValidAdminAuth } from './admin-auth';

const basic = (u: string, p: string) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');

test('accepts the configured credentials', () => {
	expect(isValidAdminAuth(basic('root', 'hunter2'), 'root', 'hunter2')).toBe(true);
});

test('password may contain colons', () => {
	expect(isValidAdminAuth(basic('root', 'a:b:c'), 'root', 'a:b:c')).toBe(true);
});

test('rejects wrong username, wrong password, or a prefix of the password', () => {
	expect(isValidAdminAuth(basic('nope', 'hunter2'), 'root', 'hunter2')).toBe(false);
	expect(isValidAdminAuth(basic('root', 'wrong'), 'root', 'hunter2')).toBe(false);
	expect(isValidAdminAuth(basic('root', 'hunter'), 'root', 'hunter2')).toBe(false);
});

test('rejects missing, non-Basic or malformed headers', () => {
	expect(isValidAdminAuth(null, 'root', 'hunter2')).toBe(false);
	expect(isValidAdminAuth('Bearer abc', 'root', 'hunter2')).toBe(false);
	expect(isValidAdminAuth('Basic !!!notbase64', 'root', 'hunter2')).toBe(false);
	expect(isValidAdminAuth('Basic ' + Buffer.from('no-colon').toString('base64'), 'root', 'hunter2')).toBe(false);
});

test('fails closed when credentials are not configured', () => {
	expect(isValidAdminAuth(basic('', ''), '', '')).toBe(false);
	expect(isValidAdminAuth(basic('root', 'x'), undefined, undefined)).toBe(false);
});

test('gates /cloud/admin and everything under it, nothing else', () => {
	expect(isAdminRoute('/cloud/admin')).toBe(true);
	expect(isAdminRoute('/cloud/admin/')).toBe(true);
	expect(isAdminRoute('/cloud/admin/requests')).toBe(true);
	expect(isAdminRoute('/cloud/administrator')).toBe(false);
	expect(isAdminRoute('/cloud/files')).toBe(false);
});
