/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_AssigneeInputs */

const en_select_assignee = /** @type {(inputs: Select_AssigneeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Assignee`)
};

const zh_select_assignee = /** @type {(inputs: Select_AssigneeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择负责人`)
};

/**
* | output |
* | --- |
* | "Select Assignee" |
*
* @param {Select_AssigneeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_assignee = /** @type {((inputs?: Select_AssigneeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_AssigneeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_assignee(inputs)
	return zh_select_assignee(inputs)
});