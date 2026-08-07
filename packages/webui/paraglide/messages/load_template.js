/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Load_TemplateInputs */

const en_load_template = /** @type {(inputs: Load_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Load Template`)
};

const zh_load_template = /** @type {(inputs: Load_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`加载模板`)
};

/**
* | output |
* | --- |
* | "Load Template" |
*
* @param {Load_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const load_template = /** @type {((inputs?: Load_TemplateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Load_TemplateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_load_template(inputs)
	return zh_load_template(inputs)
});