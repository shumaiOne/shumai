/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enter_Template_NameInputs */

const en_enter_template_name = /** @type {(inputs: Enter_Template_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter template name...`)
};

const zh_enter_template_name = /** @type {(inputs: Enter_Template_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`请输入模板名称...`)
};

/**
* | output |
* | --- |
* | "Enter template name..." |
*
* @param {Enter_Template_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_template_name = /** @type {((inputs?: Enter_Template_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enter_Template_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_enter_template_name(inputs)
	return zh_enter_template_name(inputs)
});