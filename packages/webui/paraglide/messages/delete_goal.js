/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_GoalInputs */

const en_delete_goal = /** @type {(inputs: Delete_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Goal`)
};

const zh_delete_goal = /** @type {(inputs: Delete_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除目标`)
};

/**
* | output |
* | --- |
* | "Delete Goal" |
*
* @param {Delete_GoalInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_goal = /** @type {((inputs?: Delete_GoalInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_GoalInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_goal(inputs)
	return zh_delete_goal(inputs)
});