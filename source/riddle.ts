import Telegraf, {ComposerConstructor, Extra, Markup} from 'telegraf'

import * as entities from './entities'
import {
	getTopCategories,
	getSubCategories,
	getItems
} from './queries'

function labeledItem(item: string, lang: string): string {
	const label = entities.label(item, lang)
	const description = entities.description(item, lang)
	const url = `https://www.wikidata.org/wiki/${item}`

	let text = `*${label}* [${item}](${url})`

	if (description) {
		text += `\n  ${description}`
	}

	return text
}

function getRandomEntries<T>(arr: T[], amount = 1): T[] {
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

function getLang(ctx: any): string {
	const lang: string = ctx.from.language_code
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

	await entities.load(topCategory, ...subCategories, ...items, differentItem)

	const mediaArr = items.map(o => buildEntry(o, lang))

	let text = ''
	text += labeledItem(topCategory, lang)

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

export async function send(ctx: any, topCategoryKind: string): Promise<void> {
	const lang = getLang(ctx)

	ctx.replyWithChatAction('upload_photo').catch(() => {})
	const {mediaArr, text, keyboard} = await create(topCategoryKind, lang)
	ctx.replyWithChatAction('upload_photo').catch(() => {})

	const msg = await ctx.replyWithMediaGroup(mediaArr)
	await ctx.reply(text, (Extra.markdown().markup(keyboard) as Extra).webPreview(false).inReplyTo(msg.slice(-1)[0].message_id))
}

function buildEntry(item: string, lang: string): {type: 'photo'; media: string; caption: string; parse_mode: 'Markdown'} {
	const images = entities.images(item, 800)
	const caption = labeledItem(item, lang)

	const imageUrl = getRandomEntries(images)[0]

	return {
		type: 'photo',
		media: imageUrl,
		caption,
		parse_mode: 'Markdown'
	}
}

const bot: ComposerConstructor = new (Telegraf as any).Composer()

bot.action('a-no', ctx => ctx.answerCbQuery('👎'))

bot.action(/a:(Q\d+):(Q\d+):(Q\d+)/, async (ctx: any, next) => {
	const correctCategory = ctx.match[1]
	const differentCategory = ctx.match[2]
	const differentItem = ctx.match[3]
	const lang = getLang(ctx)

	const originalItems: string[] = ctx.callbackQuery.message.entities
		.filter((o: any) => o.url)
		.map((o: any) => o.url.split('/').slice(-1)[0])

	await entities.load(correctCategory, differentCategory, ...originalItems)

	const mainCategoryLabel = labeledItem(originalItems[0], lang)
	const correctCategoryLabel = labeledItem(correctCategory, lang)
	const differentCategoryLabel = labeledItem(differentCategory, lang)

	let text = ''
	text += mainCategoryLabel

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
		ctx.editMessageText(text, Extra.markdown().webPreview(false)),
		ctx.answerCbQuery('👍')
	])
	return next && next()
})

export function getBot(): ComposerConstructor {
	return bot
}
