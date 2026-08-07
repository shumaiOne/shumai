/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Overwrite_Existing_TemplateInputs */

const en_overwrite_existing_template = /** @type {(inputs: Overwrite_Existing_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Overwrite Existing Template`)
};

const zh_overwrite_existing_template = /** @type {(inputs: Overwrite_Existing_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`覆盖现有模板`)
};

/**
* | output |
* | --- |
* | "Overwrite Existing Template" |
*
* @param {Overwrite_Existing_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const overwrite_existing_template = /** @type {((inputs?: Overwrite_Existing_TemplateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Overwrite_Existing_TemplateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_overwrite_existing_template(inputs)
	return zh_overwrite_existing_template(inputs)
});