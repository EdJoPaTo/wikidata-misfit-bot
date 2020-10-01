import {readFileSync, existsSync} from 'fs'

import {InlineKeyboardButton} from 'telegraf/typings/markup'
import {Telegraf, Extra, Markup} from 'telegraf'
import {TelegrafWikibase} from 'telegraf-wikibase'

import {Context} from './context'
import {getTopCategories} from './queries'
import * as riddle from './riddle'
import categories from './categories'

process.title = 'wd-misfit-tgbot'

const twb = new TelegrafWikibase()

const tokenFilePath = existsSync('/run/secrets') ? '/run/secrets/bot-token.txt' : 'bot-token.txt'
const token = readFileSync(tokenFilePath, 'utf8').trim()
const bot = new Telegraf<Context>(token)

bot.use(async (ctx, next) => {
	try {
		if (next) {
			await next()
		}
	} catch (error) {
		console.log('try send error', error && error.on && error.on.payload && error.on.payload.media, error)
		await ctx.reply('😣 This happens… Please try again.')
	}
})

bot.use(twb.middleware())

bot.use(riddle.bot.middleware())

for (const t of Object.keys(categories)) {
	bot.command(t, async ctx => endlessFailing(ctx, categories[t], 0))
}

async function endlessFailing(ctx: any, categoryQNumber: string, attempt: number): Promise<void> {
	/* Reasons can be
	- Image is SVG, Telegram does not support SVG
	- Image was not successfully loaded by Telegram fast enough
	- Telegram supports only up to 5MB images via URL
	- undefined internet witchcraft
	*/
	try {
		await riddle.send(ctx, categoryQNumber)
		return
	} catch (error) {
		if (attempt < 2) {
			console.error('endlessFailing', attempt, error.message)
		} else {
			console.error('endlessFailing', attempt, error)
		}

		if (attempt < 5) {
			await endlessFailing(ctx, categoryQNumber, attempt + 1)
		}
	}
}

async function selectorButton(context: Context, categoryEntityId: string): Promise<InlineKeyboardButton> {
	const reader = await context.wb.reader(categoryEntityId)
	return Markup.callbackButton(reader.label(), `category:${categoryEntityId}`)
}

async function selectorKeyboard(context: Context): Promise<InlineKeyboardButton[]> {
	await context.wb.preload(Object.values(categories))
	const buttons = await Promise.all(Object.values(categories)
		.map(async o => selectorButton(context, o))
	)
	const sorted = buttons
		.sort((a, b) => a.text.localeCompare(b.text, context.wb.locale()))
	return sorted
}

bot.action(/category:(Q\d+)/, async ctx => {
	ctx.answerCbQuery().catch(() => {})
	ctx.editMessageText('One of the images does not fit…')
		.catch(() => {})
	return endlessFailing(ctx, ctx.match![1], 0)
})

bot.command(['start', 'help'], async context => {
	let text = ''
	text += 'When you chose a category you get 4 images from it. One of them does not fit into the same category as the other 3.'

	if (!context.message || !context.from) {
		throw new Error('something is strange')
	}

	if (context.message.text === '/help') {
		text += '\n\n'
		text += 'All the data is coming from wikidata.org. Also this bot tries to respect your Telegram Client language for wikidata items when possible.'
		text += '\n\n'
		text += 'If you think something is wrong with the data use the link to the wikidata and improve it. 😎'
		text += '\n'
		text += 'Also you can send Pull Requests for this bot at https://github.com/EdJoPaTo/wikidata-misfit-bot. Maybe add another category. 🙃'
	}

	return context.reply(text, Extra.webPreview(false).markup(
		Markup.inlineKeyboard(await selectorKeyboard(context), {columns: 3})
	))
})

bot.action(/^a:.+/, Telegraf.privateChat(async context => {
	if (!context.from) {
		throw new Error('something is strange')
	}

	return context.reply('Another one?', Extra.markup(
		Markup.inlineKeyboard(await selectorKeyboard(context), {columns: 3})
	) as any)
}))

bot.catch((error: any) => {
	console.error('bot.catch', error)
})

async function startup(): Promise<void> {
	await Promise.all(
		Object.keys(categories)
			.map(async o => preloadCategory(o))
	)

	console.log(new Date(), 'cache filled')

	await bot.telegram.setMyCommands([
		{command: 'start', description: 'show the category selector'},
		{command: 'help', description: 'show help'}
	])

	await bot.launch()
	console.log(new Date(), 'Bot started as', bot.options.username)
}

async function preloadCategory(category: string): Promise<void> {
	const identifier = `preloadCategory ${category}`
	console.time(identifier)
	const qNumber = categories[category]
	try {
		await getTopCategories(qNumber)
	} catch (error) {
		console.log(identifier, 'failed', qNumber, error.message)
	}

	console.timeEnd(identifier)
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
startup()
