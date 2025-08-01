import {env} from 'node:process';
import {Bot} from 'grammy';
import type {InlineKeyboardButton} from 'grammy/types';
import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {TelegrafWikibase} from 'telegraf-wikibase';
import {CATEGORIES, type Category} from './categories.js';
import type {Context} from './context.js';
import {getButtonsAsRows} from './keyboard.js';
import {getTopCategories} from './queries.js';
import * as riddle from './riddle.js';

const twb = new TelegrafWikibase({
	logQueriedEntityIds: env['NODE_ENV'] !== 'production',
	userAgent: 'github.com/EdJoPaTo/wikidata-misfit-bot',
});

const token = env['BOT_TOKEN'];
if (!token) {
	throw new Error('You have to provide the bot-token from @BotFather via environment variable (BOT_TOKEN)');
}

const baseBot = new Bot<Context>(token);

if (env['NODE_ENV'] !== 'production') {
	baseBot.use(generateUpdateMiddleware());
}

const bot = baseBot.errorBoundary(async ({error, ctx}) => {
	console.log('try send error', error);
	await ctx.reply('😣 This happens… Please try again.');
});

bot.use(twb.middleware());

bot.use(riddle.bot.middleware());

for (const qNumber of Object.values(CATEGORIES)) {
	bot.command(qNumber, async ctx => endlessFailing(ctx, qNumber, 0));
}

async function endlessFailing(
	ctx: Context,
	categoryQNumber: string,
	attempt: number,
): Promise<void> {
	/* Reasons can be
	- Image is SVG, Telegram does not support SVG
	- Image was not successfully loaded by Telegram fast enough
	- Telegram supports only up to 5MB images via URL
	- undefined internet witchcraft
	*/
	try {
		await riddle.send(ctx, categoryQNumber);
	} catch (error: unknown) {
		if (attempt < 2) {
			console.error(
				'endlessFailing',
				attempt,
				error instanceof Error ? error.message : error,
			);
		} else {
			console.error('endlessFailing', attempt, error);
		}

		if (attempt < 5) {
			await endlessFailing(ctx, categoryQNumber, attempt + 1);
		}
	}
}

async function selectorButton(
	context: Context,
	categoryEntityId: string,
): Promise<InlineKeyboardButton.CallbackButton> {
	const reader = await context.wb.reader(categoryEntityId);
	return {
		text: reader.label(),
		callback_data: `category:${categoryEntityId}`,
	};
}

async function selectorKeyboard(context: Context): Promise<InlineKeyboardButton[][]> {
	await context.wb.preload(Object.values(CATEGORIES));
	const buttons = await Promise.all(Object.values(CATEGORIES).map(async o => selectorButton(context, o)));
	const sorted = buttons.sort((a, b) =>
		a.text.localeCompare(b.text, context.wb.locale()));
	const keyboard = getButtonsAsRows(sorted, 3);
	return keyboard;
}

bot.callbackQuery(/category:(Q\d+)/, async ctx => {
	try {
		await ctx.answerCallbackQuery();
		await ctx.editMessageText('One of the images does not fit…');
	} catch {}

	return endlessFailing(ctx, ctx.match[1]!, 0);
});

bot.command(['start', 'help'], async context => {
	let text = '';
	text
		+= 'When you chose a category you get 4 images from it. One of them does not fit into the same category as the other 3.';

	if (context.message?.text === '/help') {
		text += '\n\n';
		text
			+= 'All the data is coming from wikidata.org. Also this bot tries to respect your Telegram Client language for wikidata items when possible.';
		text += '\n\n';
		text
			+= 'If you think something is wrong with the data use the link to the wikidata and improve it. 😎';
		text += '\n';
		text
			+= 'Also you can send Pull Requests for this bot at https://github.com/EdJoPaTo/wikidata-misfit-bot. Maybe add another category. 🙃';
	}

	return context.reply(text, {
		link_preview_options: {is_disabled: true},
		reply_markup: {inline_keyboard: await selectorKeyboard(context)},
	});
});

bot.command('privacy', async ctx =>
	ctx.reply(
		'This bot does not store any data about you and works stateless. It requests Wikidata with a common identity for all users, so Wikidata can not distinguish any users of this bot. See the source code at https://github.com/EdJoPaTo/wikidata-misfit-bot',
		{reply_markup: {remove_keyboard: true}},
	));

bot
	.filter(o => o.chat?.type === 'private')
	.callbackQuery(/^a:.+/, async context =>
		context.reply('Another one?', {
			reply_markup: {inline_keyboard: await selectorKeyboard(context)},
		}));
if (env['NODE_ENV'] !== 'production') {
	bot.use(ctx => {
		console.log('unhandled update', ctx.update);
	});
}

async function preloadCategory(category: Category): Promise<void> {
	const identifier = `preloadCategory ${category}`;
	console.time(identifier);
	const qNumber = CATEGORIES[category];
	try {
		await getTopCategories(qNumber);
	} catch (error: unknown) {
		console.log(
			identifier,
			'failed',
			qNumber,
			error instanceof Error ? error.message : error,
		);
	}

	console.timeEnd(identifier);
}

await Promise.all(Object.keys(CATEGORIES).map(async o => preloadCategory(o as Category)));

console.log(new Date(), 'cache filled');

await baseBot.api.setMyCommands([
	{command: 'start', description: 'show the category selector'},
	{command: 'help', description: 'show help'},
]);

await baseBot.start({
	onStart(botInfo) {
		console.log(new Date(), 'Bot starts as', botInfo.username);
	},
});
