const levels = ['debug', 'info', 'warn', 'error'];
const minLevel = levels.indexOf(process.env.LOG_LEVEL || 'info');

function log(level, ...args) {
    if (levels.indexOf(level) >= minLevel) {
        const prefix = level === 'error' ? '✗' : level === 'info' ? '✓' : '';
        const out = level === 'error' ? console.error : console.log;
        out(prefix ? [prefix, ...args].join(' ') : args.join(' '));
    }
}

module.exports = {
    debug: (...args) => log('debug', ...args),
    info: (...args) => log('info', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
};
