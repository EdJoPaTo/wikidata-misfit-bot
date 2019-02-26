const wdk = require('wikidata-sdk')
const got = require('got')

const cacheMap = new Map()

async function getSimplifiedQueryResults(query, caching = true) {
	const url = wdk.sparqlQuery(query)
	const options = {}
	if (caching) {
		options.cache = cacheMap
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

function logResponse({fromCache, retryCount, timing}, ...additionals) {
	if (!fromCache && process.env.NODE_ENV !== 'production') {
		console.log(new Date(), retryCount, timing, ...additionals)
	}
}

async function getTopCategories(topCategoryKind) {
	const query = `SELECT ?topclass
	WHERE {
		SELECT ?topclass ?middleclass WHERE {
			?topclass wdt:P279* wd:${topCategoryKind}.
			?middleclass wdt:P279 ?topclass.
			{ ?item wdt:P31 ?middleclass. }
			UNION
			{ ?item wdt:P279+ ?middleclass. }
			FILTER EXISTS {?item wdt:P18 ?image}.
		}
		GROUP BY ?topclass ?middleclass
		HAVING(COUNT(?item) >= 5)
	}
	GROUP BY ?topclass
	HAVING(COUNT(?middleclass) >= 2)`

	const response = await getSimplifiedQueryResults(query)
	logResponse(response, 'getTopCategories', topCategoryKind)
	return response.result
}

async function getSubCategories(topCategory) {
	const query = `SELECT ?middleclass
WHERE {
  ?middleclass wdt:P279 wd:${topCategory}.
	{ ?item wdt:P31 ?middleclass. }
	UNION
	{ ?item wdt:P279+ ?middleclass. }
  FILTER EXISTS {?item wdt:P18 ?image}.
}
GROUP BY ?middleclass
HAVING(COUNT(?item) >= 5)`

	const response = await getSimplifiedQueryResults(query)
	logResponse(response, 'getSubCategories', topCategory)
	return response.result
}

async function getItems(parentItem) {
	const query = `SELECT ?item
WHERE {
	BIND (wd:${parentItem} as ?class)
	{ ?item wdt:P31 ?class. }
	UNION
	{ ?item wdt:P279+ ?class. }
	FILTER EXISTS {?item wdt:P18 ?image}.
}`

	const response = await getSimplifiedQueryResults(query)
	logResponse(response, 'getItems', parentItem)
	return response.result
}

async function getLabel(item, ...language) {
	if (!language.includes('en')) {
		language.push('en')
	}

	const query = `SELECT ?itemLabel
WHERE {
  BIND (wd:${item} as ?item)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${language.join(',')}". }
}`
	const response = await getSimplifiedQueryResults(query)
	logResponse(response, 'getLabel', item, language)
	return response.result[0]
}

async function getImages(item) {
	const query = `SELECT ?image
WHERE {
  BIND (wd:${item} as ?item)
  ?item wdt:P18 ?image.
}`
	const response = await getSimplifiedQueryResults(query)
	logResponse(response, 'getImages', item)
	return response.result
}

module.exports = {
	getTopCategories,
	getSubCategories,
	getItems,
	getLabel,
	getImages
}
