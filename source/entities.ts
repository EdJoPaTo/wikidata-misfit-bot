/* eslint @typescript-eslint/no-require-imports: warn */
/* eslint @typescript-eslint/no-var-requires: warn */

import wdk, {EntitySimplified} from 'wikidata-sdk'

const got = require('got')

const cache: {[qNumber: string]: EntitySimplified} = {}

export async function load(...qNumbers: string[]): Promise<void> {
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

function raw(qNumber: string): EntitySimplified {
	return cache[qNumber]
}

export function label(qNumber: string, lang: string): string {
	const entity = raw(qNumber)
	if (!entity || !entity.labels) {
		return qNumber
	}

	return entity.labels[lang] || qNumber
}

export function description(qNumber: string, lang: string): string | undefined {
	const entity = raw(qNumber)
	if (!entity || !entity.descriptions) {
		return
	}

	return entity.descriptions[lang]
}

export function images(qNumber: string, width?: number): string[] {
	const images = claim(qNumber, 'P18')
		.map(o => wdk.getImageUrl(o, width))
	return images
}

export function claim(qNumber: string, claim: string): any[] {
	const entity = raw(qNumber)
	if (!entity || !entity.claims) {
		return []
	}

	return entity.claims[claim]
}
