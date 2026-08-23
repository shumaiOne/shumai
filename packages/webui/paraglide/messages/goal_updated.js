/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Goal_UpdatedInputs */

const en_goal_updated = /** @type {(inputs: Goal_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Goal updated`)
};

const zh_goal_updated = /** @type {(inputs: Goal_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`目标已更新`)
};

/**
* | output |
* | --- |
* | "Goal updated" |
*
* @param {Goal_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_updated = /** @type {((inputs?: Goal_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Goal_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_goal_updated(inputs)
	return zh_goal_updated(inputs)
});