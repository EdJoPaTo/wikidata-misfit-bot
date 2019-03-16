const wdk = require('wikidata-sdk')
const got = require('got')

const cache = {}

async function load(...qNumbers) {
	const existing = Object.keys(cache)
	const needed = qNumbers
		.filter(o => !existing.includes(o))

	if (needed.length === 0) {
		return
	}

	// https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities
	const url = wdk.getEntities({
		ids: needed,
		props: ['labels', 'descriptions', 'claims']
	})

	const {body} = await got(url)
	const {entities} = JSON.parse(body)
	const simplified = wdk.simplify.entities(entities)

	for (const q of Object.keys(simplified)) {
		cache[q] = simplified[q]
	}
}

function raw(qNumber) {
	return cache[qNumber]
}

function label(qNumber, lang) {
	const labels = (raw(qNumber) || {}).labels || {}
	return labels[lang] || qNumber
}

function description(qNumber, lang) {
	const descriptions = (raw(qNumber) || {}).descriptions || {}
	return descriptions[lang]
}

function images(qNumber, width) {
	const claims = (raw(qNumber) || {}).claims || {}
	const images = claims.P18
		.map(o => wdk.getImageUrl(o, width))
	return images
}

module.exports = {
	load,
	raw,
	label,
	description,
	images
}
