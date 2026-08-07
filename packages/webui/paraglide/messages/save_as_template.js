/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Save_As_TemplateInputs */

const en_save_as_template = /** @type {(inputs: Save_As_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Save as Template...`)
};

const zh_save_as_template = /** @type {(inputs: Save_As_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`保存为模板...`)
};

/**
* | output |
* | --- |
* | "Save as Template..." |
*
* @param {Save_As_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const save_as_template = /** @type {((inputs?: Save_As_TemplateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Save_As_TemplateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_save_as_template(inputs)
	return zh_save_as_template(inputs)
});