/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_TemplateInputs */

const en_delete_template = /** @type {(inputs: Delete_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Template`)
};

const zh_delete_template = /** @type {(inputs: Delete_TemplateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除模板`)
};

/**
* | output |
* | --- |
* | "Delete Template" |
*
* @param {Delete_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_template = /** @type {((inputs?: Delete_TemplateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_TemplateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_template(inputs)
	return zh_delete_template(inputs)
});