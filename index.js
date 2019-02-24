const fs = require('fs')

const Telegraf = require('telegraf')

const riddle = require('./riddle')
const categories = require('./categories')
const {getTopCategories} = require('./queries')

const tokenFilePath = process.env.NODE_ENV === 'production' ? process.env.npm_package_config_tokenpath : 'token.txt'
const token = fs.readFileSync(tokenFilePath, 'utf8').trim()
const bot = new Telegraf(token)

bot.use(async (ctx, next) => {
	try {
		await next()
	} catch (error) {
		console.log('try send error', error)
		await ctx.reply('😣 This happens… Please try again.')
	}
})

bot.use(riddle.bot)

Promise.all(
	Object.keys(categories).map(o => getTopCategories(o))
).then(() => {
	console.log('cache filled')
})

for (const t of Object.keys(categories)) {
	bot.command(t, ctx => riddle.send(ctx, categories[t]))
}

bot.command(['start', 'help'], ctx => {
	let text = ''
	text += 'When you chose a category you get 4 images from it. One of them does not fit into the same category as the other 3.'
	text += '\n'
	text += 'For example try /tool or /food as a category.'
	text += '\n\n'
	text += 'All the data is coming from wikidata.org. Also this bot tries to respect your Telegram Client language for wikidata items when possible.'
	text += '\n\n'
	text += 'If you think something is wrong with the data use the link to the wikidata and improve it. 😎'
	text += '\n'
	text += 'Also you can send Pull Requests for this bot at https://github.com/EdJoPaTo/wikidata-misfit-bot. Maybe add another category. 🙃'

	return ctx.reply(text)
})

bot.use(ctx => ctx.reply('😳 try /tool or another command. Maybe see /help'))

bot.catch(error => {
	console.error('bot.catch', error)
})

bot.startPolling()
