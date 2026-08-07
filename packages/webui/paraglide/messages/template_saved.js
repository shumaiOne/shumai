/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Template_SavedInputs */

const en_template_saved = /** @type {(inputs: Template_SavedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Template saved successfully`)
};

const zh_template_saved = /** @type {(inputs: Template_SavedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模板保存成功`)
};

/**
* | output |
* | --- |
* | "Template saved successfully" |
*
* @param {Template_SavedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const template_saved = /** @type {((inputs?: Template_SavedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Template_SavedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_template_saved(inputs)
	return zh_template_saved(inputs)
});