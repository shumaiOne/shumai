/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Custom_IdInputs */

const en_custom_id = /** @type {(inputs: Custom_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Custom ID`)
};

const zh_custom_id = /** @type {(inputs: Custom_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自定义 ID`)
};

/**
* | output |
* | --- |
* | "Custom ID" |
*
* @param {Custom_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const custom_id = /** @type {((inputs?: Custom_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Custom_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_custom_id(inputs)
	return zh_custom_id(inputs)
});