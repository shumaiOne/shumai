/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Goal_TitleInputs */

const en_goal_title = /** @type {(inputs: Goal_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Goal Title`)
};

const zh_goal_title = /** @type {(inputs: Goal_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`目标标题`)
};

/**
* | output |
* | --- |
* | "Goal Title" |
*
* @param {Goal_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_title = /** @type {((inputs?: Goal_TitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Goal_TitleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_goal_title(inputs)
	return zh_goal_title(inputs)
});