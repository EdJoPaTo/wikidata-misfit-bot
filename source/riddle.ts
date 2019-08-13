import {Composer, ContextMessageUpdate, Extra, Markup} from 'telegraf'
import WikidataEntityReader from 'wikidata-entity-reader'
import WikidataEntityStore from 'wikidata-entity-store'

import {
	commonParents,
	getTopCategories,
	getSubCategories,
	getItems
} from './queries'

let store: WikidataEntityStore

export function init(entityStore: WikidataEntityStore): void {
	store = entityStore
}

function labeledItem(item: string, lang: string): string {
	const reader = new WikidataEntityReader(store.entity(item), lang)

	let text = `*${reader.label()}* [${reader.qNumber()}](${reader.url()})`

	const description = reader.description()
	if (description) {
		text += `\n  ${description}`
	}

	return text
}

function getRandomEntries<T>(arr: readonly T[], amount = 1): T[] {
	if (amount > arr.length) {
		throw new Error(`amount (${amount}) < arr.length (${arr.length})`)
	}

	const randomIds: number[] = []
	while (randomIds.length < amount) {
		const rand = Math.floor(Math.random() * arr.length)
		if (!randomIds.includes(rand)) {
			randomIds.push(rand)
		}
	}

	const entries = randomIds
		.map(i => arr[i])

	return entries
}

function getLang(ctx: ContextMessageUpdate): string {
	if (!ctx.from) {
		throw new Error('thats a strange context')
	}

	const lang: string = ctx.from.language_code || 'en'
	return lang.split('-')[0]
}

async function pickItems(correctQNumber: string, differentQNumber: string): Promise<{differentItem: string; items: string[]}> {
	const [allCorrect, allDifferent]: [string[], string[]] = await Promise.all([
		getItems(correctQNumber),
		getItems(differentQNumber)
	])

	const correctItems = getRandomEntries(allCorrect, 3)
	const differentItem = getRandomEntries(allDifferent)[0]

	const items = [
		...correctItems
	]
	items.splice(Math.floor(Math.random() * (items.length + 1)), 0, differentItem)

	return {
		differentItem,
		items
	}
}

async function create(topCategoryKind: string, lang: string): Promise<any> {
	const topCategory = getRandomEntries(await getTopCategories(topCategoryKind))[0]
	const subCategories = getRandomEntries(await getSubCategories(topCategory), 2)
	const {items, differentItem} = await pickItems(subCategories[0], subCategories[1])

	await store.preloadQNumbers(topCategory, ...subCategories, ...items, differentItem)

	const mediaArr = items.map(o => buildEntry(o, lang))

	let text = ''
	text += labeledItem(subCategories[0], lang)

	text += '\n\n'
	text += mediaArr
		.map(o => o.caption)
		.join('\n')

	const keyboard = Markup.inlineKeyboard(
		items.map((o, i) => {
			const text = `🚫 ${i + 1}`
			if (o === differentItem) {
				return Markup.callbackButton(text, `a:${subCategories[0]}:${subCategories[1]}:${differentItem}`)
			}

			return Markup.callbackButton(text, 'a-no')
		})
	)

	return {
		keyboard,
		mediaArr,
		text
	}
}

export async function send(ctx: ContextMessageUpdate, topCategoryKind: string): Promise<void> {
	const lang = getLang(ctx)

	ctx.replyWithChatAction('upload_photo').catch(() => {})
	const {mediaArr, text, keyboard} = await create(topCategoryKind, lang)
	ctx.replyWithChatAction('upload_photo').catch(() => {})

	const msg = await (ctx as any).replyWithMediaGroup(mediaArr)
	await ctx.reply(text, (Extra.markdown().markup(keyboard) as Extra).webPreview(false).inReplyTo(msg.slice(-1)[0].message_id) as any)
}

function buildEntry(item: string, lang: string): {type: 'photo'; media: string; caption: string; parse_mode: 'Markdown'} {
	const reader = new WikidataEntityReader(store.entity(item), lang)
	const images = reader.images(800)
	const caption = labeledItem(item, lang)

	const imageUrl = getRandomEntries(images)[0]

	return {
		type: 'photo',
		media: imageUrl,
		caption,
		parse_mode: 'Markdown'
	}
}

const bot = new Composer()

bot.action('a-no', async ctx => ctx.answerCbQuery('👎'))

bot.action(/a:(Q\d+):(Q\d+):(Q\d+)/, async (ctx: ContextMessageUpdate, next) => {
	if (!(ctx as any).match || !ctx.callbackQuery || !ctx.callbackQuery.message || !ctx.callbackQuery.message.entities) {
		throw new Error('something is wrong with the callback_data')
	}

	const match = (ctx as any).match as RegExpExecArray
	const correctCategory = match[1]
	const differentCategory = match[2]
	const differentItem = match[3]
	const lang = getLang(ctx)

	const originalItems: string[] = ctx.callbackQuery.message.entities
		.filter(o => o.url)
		.map(o => o.url as string)
		.map(o => o.split('/').slice(-1)[0])

	const commonCategoryItems = await commonParents(correctCategory, differentCategory)

	await store.preloadQNumbers(correctCategory, differentCategory, ...commonCategoryItems, ...originalItems)

	const commonCategoryLabels = commonCategoryItems
		.map(o => labeledItem(o, lang))

	const correctCategoryLabel = labeledItem(correctCategory, lang)
	const differentCategoryLabel = labeledItem(differentCategory, lang)

	let text = ''
	text += commonCategoryLabels.join('\n')

	text += '\n\n'
	const oldLines = await Promise.all(
		originalItems
			.slice(1)
			.map(async o => {
				const emoji = o === differentItem ? '🚫' : '✅'
				return `${emoji} ${labeledItem(o, lang)}`
			})
	)
	text += oldLines
		.join('\n')

	text += '\n\n'
	text += `✅3x ${correctCategoryLabel}`
	text += '\n'
	text += `🚫1x ${differentCategoryLabel}`

	await Promise.all([
		ctx.editMessageText(text, Extra.markdown().webPreview(false) as any),
		ctx.answerCbQuery('👍')
	])
	return next && next()
})

export function getBot(): Composer<ContextMessageUpdate> {
	return bot
}
