import { EventEmitter } from 'events';

export const systemEvents = new EventEmitter();

export const SystemEventTypes = {
    ERROR: 'SYSTEM_ERROR',
    CRITICAL: 'CRITICAL_ERROR',
    SIGNAL: 'SIGNAL_GENERATED'
};
