/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Current_Project_LabelInputs */

const en_current_project_label = /** @type {(inputs: Current_Project_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Current Project`)
};

const zh_current_project_label = /** @type {(inputs: Current_Project_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`当前项目`)
};

/**
* | output |
* | --- |
* | "Current Project" |
*
* @param {Current_Project_LabelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const current_project_label = /** @type {((inputs?: Current_Project_LabelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Current_Project_LabelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_current_project_label(inputs)
	return zh_current_project_label(inputs)
});