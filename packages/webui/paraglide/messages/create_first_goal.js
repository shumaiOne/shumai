/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_First_GoalInputs */

const en_create_first_goal = /** @type {(inputs: Create_First_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create your first goal to organize related tasks.`)
};

const zh_create_first_goal = /** @type {(inputs: Create_First_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建第一个目标来组织相关任务。`)
};

/**
* | output |
* | --- |
* | "Create your first goal to organize related tasks." |
*
* @param {Create_First_GoalInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_first_goal = /** @type {((inputs?: Create_First_GoalInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_First_GoalInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_first_goal(inputs)
	return zh_create_first_goal(inputs)
});