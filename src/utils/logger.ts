import pino from 'pino';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const isProduction = process.env.NODE_ENV === 'production';
const logsDir = join(process.cwd(), 'logs');
const logFilePath = join(logsDir, 'app.log');

if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
}

const streams: any[] = [
    {
        stream: isProduction
            ? process.stdout
            : pino.transport({
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
            }),
    },
    {
        stream: pino.destination({
            dest: logFilePath,
            sync: true, // Ensure logs are written immediately for /logs command
        }),
    },
];

import { systemEvents, SystemEventTypes } from './events.js';

export const logger = pino(
    {
        level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
        hooks: {
            logMethod(inputArgs, method) {
                if (method.name === 'error' || method.name === 'fatal') {
                    const msg = typeof inputArgs[0] === 'string' ? inputArgs[0] : (inputArgs[1] || 'Unknown error');
                    systemEvents.emit(SystemEventTypes.ERROR, msg);
                }
                return method.apply(this, inputArgs as [string, ...any[]]);
            }
        }
    },
    pino.multistream(streams)
);
