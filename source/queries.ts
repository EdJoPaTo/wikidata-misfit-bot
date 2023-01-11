// @ts-expect-error there are no types
import wdk from 'wikidata-sdk'

const USER_AGENT = 'github.com/EdJoPaTo/wikidata-misfit-bot'
const headers = new Headers()
headers.set('user-agent', USER_AGENT)

async function sparqlQuerySimplifiedMinified(query: string): Promise<string[]> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	const url = wdk.sparqlQuery(query) as string
	const response = await fetch(url, {headers})
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const results = await response.json()
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	return wdk.simplify.sparqlResults(results, {minimize: true}) as string[]
}

export async function getTopCategories(
	topCategoryKind: string,
): Promise<string[]> {
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

	const results = await sparqlQuerySimplifiedMinified(query)
	return results
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

	const results = await sparqlQuerySimplifiedMinified(query)
	return results
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

	const results = await sparqlQuerySimplifiedMinified(query)
	return results
}

export async function commonParents(...items: string[]): Promise<string[]> {
	const queryLines: string[] = []

	queryLines.push('SELECT ?parent WHERE {')

	for (const item of items) {
		queryLines.push(`  wd:${item} wdt:P279 ?parent.`)
	}

	queryLines.push('}')

	const query = queryLines.join('\n')
	const results = await sparqlQuerySimplifiedMinified(query)
	return results
}
