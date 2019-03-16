/* eslint @typescript-eslint/no-require-imports: warn */
/* eslint @typescript-eslint/no-var-requires: warn */

import wdk from 'wikidata-sdk'

const got = require('got')

const cacheMap = new Map()

async function getSimplifiedQueryResults(query: string): Promise<any> {
	const url = wdk.sparqlQuery(query)
	const options = {
		cache: cacheMap
	}

	const {body, retryCount, fromCache, timings} = await got(url, options)
	const result = wdk.simplify.sparqlResults(body)
	return {
		fromCache,
		result,
		retryCount,
		timing: ((timings || {}).phases || {}).total || 0
	}
}

export async function getTopCategories(topCategoryKind: string): Promise<string[]> {
	const query = `SELECT ?topclass
	WHERE {
		SELECT ?topclass ?middleclass WHERE {
			?topclass wdt:P279* wd:${topCategoryKind}.
			?middleclass wdt:P279 ?topclass.
			{ ?item wdt:P31 ?middleclass. }
			UNION
			{ ?item wdt:P279 ?middleclass. }
			FILTER EXISTS {?item wdt:P18 ?image}.
		}
		GROUP BY ?topclass ?middleclass
		HAVING(COUNT(?item) >= 5)
	}
	GROUP BY ?topclass
	HAVING(COUNT(?middleclass) >= 2)`

	const response = await getSimplifiedQueryResults(query)
	return response.result
}

export async function getSubCategories(topCategory: string): Promise<string[]> {
	const query = `SELECT ?middleclass
WHERE {
  ?middleclass wdt:P279 wd:${topCategory}.
	{ ?item wdt:P31 ?middleclass. }
	UNION
	{ ?item wdt:P279 ?middleclass. }
  FILTER EXISTS {?item wdt:P18 ?image}.
}
GROUP BY ?middleclass
HAVING(COUNT(?item) >= 5)`

	const response = await getSimplifiedQueryResults(query)
	return response.result
}

export async function getItems(parentItem: string): Promise<string[]> {
	const query = `SELECT ?item
WHERE {
	BIND (wd:${parentItem} as ?class)
	{ ?item wdt:P31 ?class. }
	UNION
	{ ?item wdt:P279 ?class. }
	FILTER EXISTS {?item wdt:P18 ?image}.
}`

	const response = await getSimplifiedQueryResults(query)
	return response.result
}

module.exports = {
	getTopCategories,
	getSubCategories,
	getItems
}
