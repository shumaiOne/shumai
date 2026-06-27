/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} UnreadInputs */

const en_unread = /** @type {(inputs: UnreadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unread`)
};

const zh_unread = /** @type {(inputs: UnreadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未读`)
};

/**
* | output |
* | --- |
* | "Unread" |
*
* @param {UnreadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unread = /** @type {((inputs?: UnreadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<UnreadInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unread(inputs)
	return zh_unread(inputs)
});