/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Copy_HereInputs */

const en_copy_here = /** @type {(inputs: Copy_HereInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Copy Here`)
};

const zh_copy_here = /** @type {(inputs: Copy_HereInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`复制到此处`)
};

/**
* | output |
* | --- |
* | "Copy Here" |
*
* @param {Copy_HereInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copy_here = /** @type {((inputs?: Copy_HereInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Copy_HereInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_copy_here(inputs)
	return zh_copy_here(inputs)
});