/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Edit_GoalInputs */

const en_edit_goal = /** @type {(inputs: Edit_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Edit Goal`)
};

const zh_edit_goal = /** @type {(inputs: Edit_GoalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`编辑目标`)
};

/**
* | output |
* | --- |
* | "Edit Goal" |
*
* @param {Edit_GoalInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_goal = /** @type {((inputs?: Edit_GoalInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Edit_GoalInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_edit_goal(inputs)
	return zh_edit_goal(inputs)
});