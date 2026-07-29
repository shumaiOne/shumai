/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Sessions_FoundInputs */

const en_no_sessions_found = /** @type {(inputs: No_Sessions_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No sessions found`)
};

const zh_no_sessions_found = /** @type {(inputs: No_Sessions_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到会话`)
};

/**
* | output |
* | --- |
* | "No sessions found" |
*
* @param {No_Sessions_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_sessions_found = /** @type {((inputs?: No_Sessions_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Sessions_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_sessions_found(inputs)
	return zh_no_sessions_found(inputs)
});