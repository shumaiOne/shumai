/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Goal_DescriptionInputs */

const en_goal_description = /** @type {(inputs: Goal_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Goal Description`)
};

const zh_goal_description = /** @type {(inputs: Goal_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`目标描述`)
};

/**
* | output |
* | --- |
* | "Goal Description" |
*
* @param {Goal_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_description = /** @type {((inputs?: Goal_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Goal_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_goal_description(inputs)
	return zh_goal_description(inputs)
});