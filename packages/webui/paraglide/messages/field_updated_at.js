/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_Updated_AtInputs */

const en_field_updated_at = /** @type {(inputs: Field_Updated_AtInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Updated At`)
};

const zh_field_updated_at = /** @type {(inputs: Field_Updated_AtInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新时间`)
};

/**
* | output |
* | --- |
* | "Updated At" |
*
* @param {Field_Updated_AtInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const field_updated_at = /** @type {((inputs?: Field_Updated_AtInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Updated_AtInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field_updated_at(inputs)
	return zh_field_updated_at(inputs)
});