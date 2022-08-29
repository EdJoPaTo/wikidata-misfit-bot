import type {Context as BaseContext} from 'grammy'
import type {MiddlewareProperty} from 'telegraf-wikibase'

export type Context = BaseContext & {
	readonly wb: MiddlewareProperty;
}
