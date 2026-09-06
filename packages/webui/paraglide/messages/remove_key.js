/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Remove_KeyInputs */

const en_remove_key = /** @type {(inputs: Remove_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remove Key`)
};

const zh_remove_key = /** @type {(inputs: Remove_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移除密钥`)
};

/**
* | output |
* | --- |
* | "Remove Key" |
*
* @param {Remove_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const remove_key = /** @type {((inputs?: Remove_KeyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Remove_KeyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_remove_key(inputs)
	return zh_remove_key(inputs)
});