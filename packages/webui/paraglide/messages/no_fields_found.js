/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Fields_FoundInputs */

const en_no_fields_found = /** @type {(inputs: No_Fields_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No fields found`)
};

const zh_no_fields_found = /** @type {(inputs: No_Fields_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到字段`)
};

/**
* | output |
* | --- |
* | "No fields found" |
*
* @param {No_Fields_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_fields_found = /** @type {((inputs?: No_Fields_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Fields_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_fields_found(inputs)
	return zh_no_fields_found(inputs)
});