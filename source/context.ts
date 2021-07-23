import {Context as BaseContext} from 'grammy'
import {MiddlewareProperty} from 'telegraf-wikibase'

export interface Context extends BaseContext {
	readonly wb: MiddlewareProperty;
}
