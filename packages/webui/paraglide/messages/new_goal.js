/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_GoalInputs */

const en_new_goal = /** @type {(inputs: New_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`New Goal`)
};

const zh_new_goal = /** @type {(inputs: New_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`新建目标`)
};

/**
* | output |
* | --- |
* | "New Goal" |
*
* @param {New_GoalInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const new_goal = /** @type {((inputs?: New_GoalInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_GoalInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_new_goal(inputs)
	return zh_new_goal(inputs)
});