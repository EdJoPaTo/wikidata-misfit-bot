import {readFileSync} from 'fs'

import {InlineKeyboardMarkup} from 'telegram-typings'
import Telegraf, {Extra, Markup} from 'telegraf'
import WikidataEntityReader from 'wikidata-entity-reader'
import WikidataEntityStore from 'wikidata-entity-store'

import categories from './categories'
import * as riddle from './riddle'
import {getTopCategories} from './queries'

const store = new WikidataEntityStore({
	properties: ['labels', 'descriptions', 'claims']
})

riddle.init(store)

const tokenFilePath = process.env.NODE_ENV === 'production' ? process.env.npm_package_config_tokenpath as string : 'token.txt'
const token = readFileSync(tokenFilePath, 'utf8').trim()
const bot = new Telegraf(token)

// For handling group/supergroup commands (/start@your_bot) you need to provide bot username.
bot.telegram.getMe().then(botInfo => {
	bot.options.username = botInfo.username
})

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

bot.use(riddle.getBot() as any)

Promise.all(
	Object.values(categories)
		.map(o => getTopCategories(o)
			.catch(() => {})
		)
).then(() => {
	console.log('cache filled')
})

for (const t of Object.keys(categories)) {
	bot.command(t, ctx => endlessFailing(ctx, categories[t]))
}

async function endlessFailing(ctx: any, categoryQNumber: string): Promise<void> {
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
		console.log('endlessFailing', error.message)
		await endlessFailing(ctx, categoryQNumber)
	}
}

async function selectorKeyboard(lang: string): Promise<InlineKeyboardMarkup> {
	await store.preloadQNumbers(...Object.values(categories))
	const buttons = Object.values(categories)
		.map(o => Markup.callbackButton(new WikidataEntityReader(store.entity(o), lang).label(), `category:${o}`))
		.sort((a, b) => a.text.localeCompare(b.text, lang))
	return Markup.inlineKeyboard(buttons, {columns: 3})
}

(bot as any).action(/category:(Q\d+)/, (ctx: any) => {
	ctx.answerCbQuery().catch(() => {})
	ctx.editMessageText('One of the images does not fit…')
		.catch(() => {})
	return endlessFailing(ctx, ctx.match[1])
})

bot.command(['start', 'help'], async ctx => {
	let text = ''
	text += 'When you chose a category you get 4 images from it. One of them does not fit into the same category as the other 3.'

	if (!ctx.message || !ctx.from) {
		throw new Error('something is strange')
	}

	if (ctx.message.text === '/help') {
		text += '\n\n'
		text += 'All the data is coming from wikidata.org. Also this bot tries to respect your Telegram Client language for wikidata items when possible.'
		text += '\n\n'
		text += 'If you think something is wrong with the data use the link to the wikidata and improve it. 😎'
		text += '\n'
		text += 'Also you can send Pull Requests for this bot at https://github.com/EdJoPaTo/wikidata-misfit-bot. Maybe add another category. 🙃'
	}

	const lang = (ctx.from.language_code || 'en').split('-')[0]
	return ctx.reply(text, Extra.webPreview(false).markup(
		await selectorKeyboard(lang)
	))
});

(bot as any).action(/^a:.+/, (Telegraf as any).privateChat(async (ctx: any) => {
	const lang = (ctx.from.language_code || 'en').split('-')[0]
	return ctx.reply('Another one?', Extra.markup(
		await selectorKeyboard(lang)
	))
}))

bot.catch((error: any) => {
	console.error('bot.catch', error)
})

bot.startPolling()
