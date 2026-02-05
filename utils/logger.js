const winston = require('winston');
const path = require('path'); 
const logLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'info';

const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), 
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(), 
    ),
    defaultMeta: { service: 'TRP-Api' },
    transports: [
        
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ level, message, timestamp, stack }) => {
                    const stackTrace = stack ? `\n${stack}` : '';
                    return `${timestamp} [${level}]: ${message}${stackTrace}`;
                })
            )
        }),
        
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'), 
            level: 'warn', 
            format: winston.format.json(),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
            zippedArchive: true, 
        }),
        
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/combined.log'),
            level: 'info', 
            format: winston.format.json(),
            maxsize: 10485760, // 10MB
            maxFiles: 3,
            tailable: true,
            zippedArchive: true,
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/exceptions.log'),
            format: winston.format.json(),
        }),
        new winston.transports.Console({
             format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ level, message, timestamp, stack }) => {
                    const stackTrace = stack ? `\n${stack}` : '';
                    return `${timestamp} [${level}]: ${message}${stackTrace}`;
                })
            )
        })
    ],
    rejectionHandlers: [ 
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/rejections.log'),
            format: winston.format.json(),
        })
    ],
    exitOnError: false, 
});

module.exports = logger;