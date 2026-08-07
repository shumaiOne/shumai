/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_New_TemplateInputs */

const en_create_new_template = /** @type {(inputs: Create_New_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create New Template`)
};

const zh_create_new_template = /** @type {(inputs: Create_New_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建新模板`)
};

/**
* | output |
* | --- |
* | "Create New Template" |
*
* @param {Create_New_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_new_template = /** @type {((inputs?: Create_New_TemplateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_New_TemplateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_new_template(inputs)
	return zh_create_new_template(inputs)
});