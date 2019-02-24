const fs = require('fs')

const Telegraf = require('telegraf')

const riddle = require('./riddle')
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

const types = {
	animal: 'Q729',
	building: 'Q41176',
	car: 'Q1420',
	computer: 'Q68',
	creature: 'Q1274979',
	food: 'Q2095',
	game: 'Q11410',
	instrument: 'Q34379',
	tool: 'Q39546',
	vehicle: 'Q42889',
	weapon: 'Q728'
}

Promise.all(
	Object.keys(types).map(o => getTopCategories(o))
).then(() => {
	console.log('cache filled')
})

for (const t of Object.keys(types)) {
	bot.command(t, ctx => riddle.send(ctx, types[t]))
}

bot.command('help', ctx => {
	let text = ''
	text += 'This bot is based on wikidata.org'
	text += '\n\n'
	text += 'Get riddles which of the 4 images it not fitting into the same category.'

	return ctx.reply(text)
})

bot.use(ctx => ctx.reply('😳 try /tool or another command'))

bot.catch(error => {
	console.error('bot.catch', error)
})

bot.startPolling()
