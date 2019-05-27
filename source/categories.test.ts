import test from 'ava'

import {getTopCategories} from './queries'

import categories from './categories'

for (const category of Object.keys(categories)) {
	test(`category has enough subcategories: ${category}`, async t => {
		const qNumber = categories[category]
		const result = await getTopCategories(qNumber)
		t.log(result.length)
		t.log(result.join(' '))
		t.true(result.length >= 5)
	})
}