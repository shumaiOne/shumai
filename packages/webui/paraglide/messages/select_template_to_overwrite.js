/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Template_To_OverwriteInputs */

const en_select_template_to_overwrite = /** @type {(inputs: Select_Template_To_OverwriteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select template to overwrite`)
};

const zh_select_template_to_overwrite = /** @type {(inputs: Select_Template_To_OverwriteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择要覆盖的模板`)
};

/**
* | output |
* | --- |
* | "Select template to overwrite" |
*
* @param {Select_Template_To_OverwriteInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_template_to_overwrite = /** @type {((inputs?: Select_Template_To_OverwriteInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Template_To_OverwriteInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_template_to_overwrite(inputs)
	return zh_select_template_to_overwrite(inputs)
});