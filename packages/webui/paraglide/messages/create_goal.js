/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_GoalInputs */

const en_create_goal = /** @type {(inputs: Create_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create Goal`)
};

const zh_create_goal = /** @type {(inputs: Create_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建目标`)
};

/**
* | output |
* | --- |
* | "Create Goal" |
*
* @param {Create_GoalInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_goal = /** @type {((inputs?: Create_GoalInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_GoalInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_goal(inputs)
	return zh_create_goal(inputs)
});