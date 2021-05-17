import {readFileSync, existsSync} from 'fs'

import {InlineKeyboardButton} from 'typegram'
import {Telegraf, Markup} from 'telegraf'
import {TelegrafWikibase} from 'telegraf-wikibase'

import {Context} from './context.js'
import {getTopCategories} from './queries.js'
import * as riddle from './riddle.js'
import categories from './categories.js'

process.title = 'wd-misfit-tgbot'

const twb = new TelegrafWikibase({
	logQueriedEntityIds: process.env['NODE_ENV'] !== 'production',
	userAgent: 'github.com/EdJoPaTo/wikidata-misfit-bot'
})

const token = (existsSync('/run/secrets/bot-token.txt') && readFileSync('/run/secrets/bot-token.txt', 'utf8').trim()) ||
	(existsSync('bot-token.txt') && readFileSync('bot-token.txt', 'utf8').trim()) ||
	process.env['BOT_TOKEN']
if (!token) {
	throw new Error('You have to provide the bot-token from @BotFather via file (bot-token.txt) or environment variable (BOT_TOKEN)')
}

const bot = new Telegraf<Context>(token)

bot.use(async (ctx, next) => {
	try {
		if (next) {
			await next()
		}
	} catch (error: unknown) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		console.log('try send error', (error as any)?.on?.payload?.media, error)
		await ctx.reply('😣 This happens… Please try again.')
	}
})

bot.use(twb.middleware())

bot.use(riddle.bot.middleware())

for (const qNumber of Object.values(categories)) {
	bot.command(qNumber, async ctx => endlessFailing(ctx, qNumber, 0))
}

async function endlessFailing(ctx: Context, categoryQNumber: string, attempt: number): Promise<void> {
	/* Reasons can be
	- Image is SVG, Telegram does not support SVG
	- Image was not successfully loaded by Telegram fast enough
	- Telegram supports only up to 5MB images via URL
	- undefined internet witchcraft
	*/
	try {
		await riddle.send(ctx, categoryQNumber)
		return
	} catch (error: unknown) {
		if (attempt < 2) {
			console.error('endlessFailing', attempt, error instanceof Error ? error.message : error)
		} else {
			console.error('endlessFailing', attempt, error)
		}

		if (attempt < 5) {
			await endlessFailing(ctx, categoryQNumber, attempt + 1)
		}
	}
}

async function selectorButton(context: Context, categoryEntityId: string): Promise<InlineKeyboardButton.CallbackButton> {
	const reader = await context.wb.reader(categoryEntityId)
	return Markup.button.callback(reader.label(), `category:${categoryEntityId}`)
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
	try {
		await ctx.answerCbQuery()
		await ctx.editMessageText('One of the images does not fit…')
	} catch {}

	return endlessFailing(ctx, ctx.match[1]!, 0)
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

	return context.reply(text, {
		...Markup.inlineKeyboard(await selectorKeyboard(context), {columns: 3}),
		disable_web_page_preview: true
	})
})

bot.action(/^a:.+/, Telegraf.privateChat(async context => {
	if (!context.from) {
		throw new Error('something is strange')
	}

	return context.reply('Another one?', {
		...Markup.inlineKeyboard(await selectorKeyboard(context), {columns: 3})
	})
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
	console.log(new Date(), 'Bot started as', bot.botInfo?.username)
}

async function preloadCategory(category: string): Promise<void> {
	const identifier = `preloadCategory ${category}`
	console.time(identifier)
	const qNumber = categories[category]!
	try {
		await getTopCategories(qNumber)
	} catch (error: unknown) {
		console.log(identifier, 'failed', qNumber, error instanceof Error ? error.message : error)
	}

	console.timeEnd(identifier)
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
startup()
