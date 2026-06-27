/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FieldInputs */

const en_field = /** @type {(inputs: FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Field`)
};

const zh_field = /** @type {(inputs: FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`字段`)
};

/**
* | output |
* | --- |
* | "Field" |
*
* @param {FieldInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const field = /** @type {((inputs?: FieldInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FieldInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field(inputs)
	return zh_field(inputs)
});