/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Template_DeletedInputs */

const en_template_deleted = /** @type {(inputs: Template_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Template deleted successfully`)
};

const zh_template_deleted = /** @type {(inputs: Template_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模板删除成功`)
};

/**
* | output |
* | --- |
* | "Template deleted successfully" |
*
* @param {Template_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const template_deleted = /** @type {((inputs?: Template_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Template_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_template_deleted(inputs)
	return zh_template_deleted(inputs)
});