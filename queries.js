const wdk = require('wikidata-sdk')
const got = require('got')

async function getSimplifiedQueryResults(query) {
	const url = wdk.sparqlQuery(query)
	const {body} = await got(url)
	const simplified = wdk.simplify.sparqlResults(body)
	return simplified
}

const topCategoryCache = {}

async function getTopCategories(topCategoryKind) {
	if (!topCategoryCache[topCategoryKind]) {
		const query = `SELECT ?topclass
		WHERE {
			SELECT ?topclass ?middleclass WHERE {
				?topclass wdt:P279+ wd:${topCategoryKind}.
				?middleclass wdt:P279 ?topclass.
				?item wdt:P279 ?middleclass.
				FILTER EXISTS {?item wdt:P18 ?image}.
			}
			GROUP BY ?topclass ?middleclass
			HAVING(COUNT(?item) >= 3)
		}
		GROUP BY ?topclass
		HAVING(COUNT(?middleclass) >= 2)`

		topCategoryCache[topCategoryKind] = await getSimplifiedQueryResults(query)
	}

	return topCategoryCache[topCategoryKind]
}

async function getSubCategories(topCategory, minItems) {
	const query = `SELECT ?middleclass
WHERE {
  ?middleclass wdt:P279 wd:${topCategory}.
  ?item wdt:P279 ?middleclass.
  FILTER EXISTS {?item wdt:P18 ?image}.
}
GROUP BY ?topclass ?middleclass
HAVING(COUNT(?item) >= ${minItems})`

	const results = await getSimplifiedQueryResults(query)
	return results
}

async function getItems(parentItem) {
	const query = `SELECT ?item
WHERE {
	?item wdt:P279 wd:${parentItem}.
	FILTER EXISTS {?item wdt:P18 ?image}.
}`

	const results = await getSimplifiedQueryResults(query)
	return results
}

async function getLabel(item, language) {
	const query = `SELECT ?itemLabel
WHERE {
  BIND (wd:${item} as ?item)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${language},en". }
}`
	const result = await getSimplifiedQueryResults(query)
	return result[0]
}

async function getImages(item) {
	const query = `SELECT ?image
WHERE {
  BIND (wd:${item} as ?item)
  ?item wdt:P18 ?image.
}`
	const result = await getSimplifiedQueryResults(query)
	return result
}

module.exports = {
	getTopCategories,
	getSubCategories,
	getItems,
	getLabel,
	getImages
}
