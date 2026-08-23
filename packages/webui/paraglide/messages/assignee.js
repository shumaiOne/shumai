/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} AssigneeInputs */

const en_assignee = /** @type {(inputs: AssigneeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Assignee`)
};

const zh_assignee = /** @type {(inputs: AssigneeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`负责人`)
};

/**
* | output |
* | --- |
* | "Assignee" |
*
* @param {AssigneeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const assignee = /** @type {((inputs?: AssigneeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<AssigneeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_assignee(inputs)
	return zh_assignee(inputs)
});