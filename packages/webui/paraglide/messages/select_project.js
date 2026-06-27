/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_ProjectInputs */

const en_select_project = /** @type {(inputs: Select_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Project`)
};

const zh_select_project = /** @type {(inputs: Select_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择项目`)
};

/**
* | output |
* | --- |
* | "Select Project" |
*
* @param {Select_ProjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_project = /** @type {((inputs?: Select_ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_ProjectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_project(inputs)
	return zh_select_project(inputs)
});