import * as wdkGot from 'wikidata-sdk-got'

const cacheMap = new Map()

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

	const results = await wdkGot.sparqlQuerySimplifiedMinified(query, {cache: cacheMap})
	return results as string[]
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

	const results = await wdkGot.sparqlQuerySimplifiedMinified(query, {cache: cacheMap})
	return results as string[]
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

	const results = await wdkGot.sparqlQuerySimplifiedMinified(query, {cache: cacheMap})
	return results as string[]
}

export async function commonParents(...items: string[]): Promise<string[]> {
	const queryLines: string[] = []

	queryLines.push('SELECT ?parent WHERE {')

	for (const item of items) {
		queryLines.push(`  wd:${item} wdt:P279 ?parent.`)
	}

	queryLines.push('}')

	const query = queryLines.join('\n')
	const results = await wdkGot.sparqlQuerySimplifiedMinified(query, {cache: cacheMap})
	return results as string[]
}
