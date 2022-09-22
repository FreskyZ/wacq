//-----------------------------------------------------------------------------------------------
// This code was generated by a tool.
// Changes to this file may cause incorrect behavior and will be lost if the code is regenerated.
//-----------------------------------------------------------------------------------------------

import { FineError } from '../../adk/error';
import { ForwardContext } from '../../adk/api-server';
import { DefaultImpl, dispatch as dispatchDefault } from './default';

export interface Impl {
    default: DefaultImpl,
}

export async function dispatch(ctx: ForwardContext, impl: Impl) {
    if (!ctx.path.startsWith('/v1')) { throw new FineError('not-found', 'invalid invocation version'); }
    const path = ctx.path.substring(3);
    if (path.startsWith('/default/')) { return await dispatchDefault(ctx, impl.default); }
    throw new FineError('not-found', 'invalid invocation');
}
