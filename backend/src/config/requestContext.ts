import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = {
  requestId?: string;
};

const store = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T) {
  return store.run(context, fn);
}

export function getRequestContext() {
  return store.getStore();
}

export function setRequestContext(context: RequestContext) {
  store.enterWith(context);
}
