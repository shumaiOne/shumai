/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} LogsInputs */

const en_logs = /** @type {(inputs: LogsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Logs`)
};

const zh_logs = /** @type {(inputs: LogsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`日志`)
};

/**
* | output |
* | --- |
* | "Logs" |
*
* @param {LogsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const logs = /** @type {((inputs?: LogsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<LogsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_logs(inputs)
	return zh_logs(inputs)
});