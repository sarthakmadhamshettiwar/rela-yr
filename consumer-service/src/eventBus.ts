import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(100); // support many concurrent SSE clients
