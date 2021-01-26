import {Context as TelegrafContext} from 'telegraf'
import {MiddlewareProperty} from 'telegraf-wikibase'

export interface Context extends TelegrafContext {
	readonly wb: MiddlewareProperty;
}
