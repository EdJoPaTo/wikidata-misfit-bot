import test from 'ava'

import {getTopCategories} from './queries.js'

import {CATEGORIES} from './categories.js'

for (const [category, qNumber] of Object.entries(CATEGORIES)) {
	test(`category has enough subcategories: ${category}`, async t => {
		t.timeout(1000 * 60 * 10) // 10 minutes
		const result = await getTopCategories(qNumber)
		t.log(result.length)
		t.log(result.join(' '))
		t.true(result.length >= 5)
	})
}
