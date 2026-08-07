/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Template_UpdatedInputs */

const en_template_updated = /** @type {(inputs: Template_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Template updated successfully`)
};

const zh_template_updated = /** @type {(inputs: Template_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模板更新成功`)
};

/**
* | output |
* | --- |
* | "Template updated successfully" |
*
* @param {Template_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const template_updated = /** @type {((inputs?: Template_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Template_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_template_updated(inputs)
	return zh_template_updated(inputs)
});