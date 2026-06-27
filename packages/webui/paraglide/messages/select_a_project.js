/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_A_ProjectInputs */

const en_select_a_project = /** @type {(inputs: Select_A_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select a project`)
};

const zh_select_a_project = /** @type {(inputs: Select_A_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择一个项目`)
};

/**
* | output |
* | --- |
* | "Select a project" |
*
* @param {Select_A_ProjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_a_project = /** @type {((inputs?: Select_A_ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_A_ProjectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_a_project(inputs)
	return zh_select_a_project(inputs)
});