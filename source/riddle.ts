import {Composer, InlineKeyboard} from 'grammy'
import type {MessageEntity} from 'grammy/types'
import type {Context} from './context.js'
import {
	commonParents,
	getItems,
	getSubCategories,
	getTopCategories,
} from './queries.js'

type MessageMedia = {
	type: 'photo';
	media: string;
	caption: string;
	parse_mode: 'Markdown';
}

async function labeledItem(context: Context, item: string): Promise<string> {
	const reader = await context.wb.reader(item)

	let text = `*${reader.label()}* [${reader.qNumber()}](${reader.url()})`

	const description = reader.description()
	if (description) {
		text += `\n  ${description}`
	}

	return text
}

function getRandomEntries<T>(array: readonly T[], amount = 1): T[] {
	if (amount > array.length) {
		throw new Error(`amount (${amount}) < arr.length (${array.length})`)
	}

	const randomIds: number[] = []
	while (randomIds.length < amount) {
		const rand = Math.floor(Math.random() * array.length)
		if (!randomIds.includes(rand)) {
			randomIds.push(rand)
		}
	}

	const entries = randomIds
		.map(i => array[i]!)

	return entries
}

async function pickItems(
	correctQNumber: string,
	differentQNumber: string,
): Promise<{differentItem: string; items: string[]}> {
	const [allCorrect, allDifferent]: [string[], string[]] = await Promise.all([
		getItems(correctQNumber),
		getItems(differentQNumber),
	])

	const correctItems = getRandomEntries(allCorrect, 3)
	const differentItem = getRandomEntries(allDifferent)[0]!

	const items = [
		...correctItems,
	]
	items.splice(
		Math.floor(Math.random() * (items.length + 1)),
		0,
		differentItem,
	)

	return {
		differentItem,
		items,
	}
}

async function create(context: Context, topCategoryKind: string) {
	const topCategory = getRandomEntries(
		await getTopCategories(topCategoryKind),
	)[0]!
	const subCategories = getRandomEntries(
		await getSubCategories(topCategory),
		2,
	)
	const {items, differentItem} = await pickItems(
		subCategories[0]!,
		subCategories[1]!,
	)

	await context.wb.preload([
		topCategory,
		...subCategories,
		...items,
		differentItem,
	])

	const mediaArray = await Promise.all(
		items.map(async o => buildEntry(context, o)),
	)

	let text = ''
	text += await labeledItem(context, subCategories[0]!)

	text += '\n\n'
	text += mediaArray
		.map(o => o.caption)
		.join('\n')

	const buttons = items.map((o, i) => {
		const text = `🚫 ${i + 1}`
		const data = o === differentItem
			? `a:${subCategories[0]!}:${subCategories[1]!}:${differentItem}`
			: 'a-no'
		return InlineKeyboard.text(text, data)
	})
	const keyboard = new InlineKeyboard([buttons])

	return {
		keyboard,
		mediaArray,
		text,
	}
}

export async function send(
	context: Context,
	topCategoryKind: string,
): Promise<void> {
	const [{mediaArray, text, keyboard}] = await Promise.all([
		create(context, topCategoryKind),
		context.replyWithChatAction('upload_photo'),
	])

	const [message] = await Promise.all([
		context.replyWithMediaGroup(mediaArray),
		context.replyWithChatAction('upload_photo'),
	])

	await context.reply(text, {
		reply_markup: keyboard,
		parse_mode: 'Markdown',
		disable_web_page_preview: true,
		reply_to_message_id: message.slice(-1)[0]!.message_id,
	})
}

async function buildEntry(
	context: Context,
	item: string,
): Promise<MessageMedia> {
	const reader = await context.wb.reader(item)
	const images = reader.images(800)
	const caption = await labeledItem(context, item)

	const imageUrl = getRandomEntries(images)[0]!

	return {
		type: 'photo',
		media: imageUrl,
		caption,
		parse_mode: 'Markdown',
	}
}

export const bot = new Composer<Context>()

bot.callbackQuery(
	'a-no',
	async ctx => ctx.answerCallbackQuery({text: '👎'}),
)

bot.callbackQuery(/a:(Q\d+):(Q\d+):(Q\d+)/, async (context, next) => {
	if (!context.callbackQuery.message?.entities || !context.match) {
		throw new Error('something is wrong with the callback_data')
	}

	const correctCategory = context.match[1]!
	const differentCategory = context.match[2]!
	const differentItem = context.match[3]!

	const originalItems: string[] = context.callbackQuery.message.entities
		.filter((o): o is MessageEntity.TextLinkMessageEntity => 'url' in o)
		.map(o => o.url)
		.map(o => o.split('/').slice(-1)[0]!)

	const commonCategoryItems = await commonParents(
		correctCategory,
		differentCategory,
	)

	await context.wb.preload([
		correctCategory,
		differentCategory,
		...commonCategoryItems,
		...originalItems,
	])

	const commonCategoryLabels = await Promise.all(
		commonCategoryItems.map(async o => labeledItem(context, o)),
	)

	const correctCategoryLabel = await labeledItem(context, correctCategory)
	const differentCategoryLabel = await labeledItem(context, differentCategory)

	let text = ''
	text += commonCategoryLabels.join('\n')

	text += '\n\n'
	const oldLines = await Promise.all(
		originalItems
			.slice(1)
			.map(async o => {
				const emoji = o === differentItem ? '🚫' : '✅'
				return `${emoji} ${await labeledItem(context, o)}`
			}),
	)
	text += oldLines
		.join('\n')

	text += '\n\n'
	text += `✅3x ${correctCategoryLabel}`
	text += '\n'
	text += `🚫1x ${differentCategoryLabel}`

	await Promise.all([
		context.editMessageText(text, {
			parse_mode: 'Markdown',
			disable_web_page_preview: true,
		}),
		context.answerCallbackQuery({text: '👍'}),
	])
	return next()
})
