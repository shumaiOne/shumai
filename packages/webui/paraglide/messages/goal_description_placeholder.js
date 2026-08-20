/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Goal_Description_PlaceholderInputs */

const en_goal_description_placeholder = /** @type {(inputs: Goal_Description_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Describe the desired outcome and success criteria...`)
};

const zh_goal_description_placeholder = /** @type {(inputs: Goal_Description_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`描述预期成果和衡量标准...`)
};

/**
* | output |
* | --- |
* | "Describe the desired outcome and success criteria..." |
*
* @param {Goal_Description_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_description_placeholder = /** @type {((inputs?: Goal_Description_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Goal_Description_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_goal_description_placeholder(inputs)
	return zh_goal_description_placeholder(inputs)
});