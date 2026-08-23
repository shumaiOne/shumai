/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Goal_CreatedInputs */

const en_goal_created = /** @type {(inputs: Goal_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Goal created`)
};

const zh_goal_created = /** @type {(inputs: Goal_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`目标已创建`)
};

/**
* | output |
* | --- |
* | "Goal created" |
*
* @param {Goal_CreatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_created = /** @type {((inputs?: Goal_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Goal_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_goal_created(inputs)
	return zh_goal_created(inputs)
});