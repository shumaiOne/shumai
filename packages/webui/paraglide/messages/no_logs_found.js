/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Logs_FoundInputs */

const en_no_logs_found = /** @type {(inputs: No_Logs_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No logs found for this session.`)
};

const zh_no_logs_found = /** @type {(inputs: No_Logs_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到此会话的日志。`)
};

/**
* | output |
* | --- |
* | "No logs found for this session." |
*
* @param {No_Logs_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_logs_found = /** @type {((inputs?: No_Logs_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Logs_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_logs_found(inputs)
	return zh_no_logs_found(inputs)
});