/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Project_SelectedInputs */

const en_no_project_selected = /** @type {(inputs: No_Project_SelectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No project selected`)
};

const zh_no_project_selected = /** @type {(inputs: No_Project_SelectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未选择项目`)
};

/**
* | output |
* | --- |
* | "No project selected" |
*
* @param {No_Project_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_project_selected = /** @type {((inputs?: No_Project_SelectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Project_SelectedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_project_selected(inputs)
	return zh_no_project_selected(inputs)
});