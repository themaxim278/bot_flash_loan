"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
// Global structured logger
// Default level: info. Override via LOG_LEVEL env.
const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
exports.logger = (0, pino_1.default)({
    level,
    base: undefined,
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
});
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map