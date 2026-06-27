/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} OptionsInputs */

const en_options = /** @type {(inputs: OptionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Options`)
};

const zh_options = /** @type {(inputs: OptionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选项`)
};

/**
* | output |
* | --- |
* | "Options" |
*
* @param {OptionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const options = /** @type {((inputs?: OptionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<OptionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_options(inputs)
	return zh_options(inputs)
});