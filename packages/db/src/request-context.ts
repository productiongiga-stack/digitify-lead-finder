import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  userId?: string;
  trpcPath?: string;
  trpcType?: string;
};

const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStore.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStore.getStore();
}

export function patchRequestContext(patch: Partial<RequestContext>) {
  const current = requestContextStore.getStore();
  if (!current) return;
  Object.assign(current, patch);
}
