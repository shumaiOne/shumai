/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Type_LabelInputs */

const en_type_label = /** @type {(inputs: Type_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Type:`)
};

const zh_type_label = /** @type {(inputs: Type_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`类型：`)
};

/**
* | output |
* | --- |
* | "Type:" |
*
* @param {Type_LabelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const type_label = /** @type {((inputs?: Type_LabelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Type_LabelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_type_label(inputs)
	return zh_type_label(inputs)
});