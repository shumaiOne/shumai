/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Template_NameInputs */

const en_template_name = /** @type {(inputs: Template_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Template Name`)
};

const zh_template_name = /** @type {(inputs: Template_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模板名称`)
};

/**
* | output |
* | --- |
* | "Template Name" |
*
* @param {Template_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const template_name = /** @type {((inputs?: Template_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Template_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_template_name(inputs)
	return zh_template_name(inputs)
});