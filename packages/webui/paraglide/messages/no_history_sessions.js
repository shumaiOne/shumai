/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_History_SessionsInputs */

const en_no_history_sessions = /** @type {(inputs: No_History_SessionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No chat history found.`)
};

const zh_no_history_sessions = /** @type {(inputs: No_History_SessionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无历史会话记录`)
};

/**
* | output |
* | --- |
* | "No chat history found." |
*
* @param {No_History_SessionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_history_sessions = /** @type {((inputs?: No_History_SessionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_History_SessionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_history_sessions(inputs)
	return zh_no_history_sessions(inputs)
});