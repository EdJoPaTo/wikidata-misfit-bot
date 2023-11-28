import {ok} from 'node:assert';
import {test} from 'node:test';
import {CATEGORIES} from './categories.js';
import {getTopCategories} from './queries.js';

await test('category has enough subcategories', {
	concurrency: 4, // Run multiple while not overwhelming Wikidata Servers
}, async t => {
	await Promise.all(
		Object.entries(CATEGORIES).map(async ([category, qNumber]) =>
			t.test(category, {
				timeout: 1000 * 70 * 10, // 70 seconds
			}, async () => {
				const result = await getTopCategories(qNumber);
				console.log('category', category, result.length, result.join(' '));
				ok(result.length >= 5);
			}),
		),
	);
});
