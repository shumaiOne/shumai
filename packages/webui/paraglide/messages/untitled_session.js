/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Untitled_SessionInputs */

const en_untitled_session = /** @type {(inputs: Untitled_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Untitled Session`)
};

const zh_untitled_session = /** @type {(inputs: Untitled_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未命名会话`)
};

/**
* | output |
* | --- |
* | "Untitled Session" |
*
* @param {Untitled_SessionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const untitled_session = /** @type {((inputs?: Untitled_SessionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Untitled_SessionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_untitled_session(inputs)
	return zh_untitled_session(inputs)
});