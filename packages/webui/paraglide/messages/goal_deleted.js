/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Goal_DeletedInputs */

const en_goal_deleted = /** @type {(inputs: Goal_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Goal deleted`)
};

const zh_goal_deleted = /** @type {(inputs: Goal_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`目标已删除`)
};

/**
* | output |
* | --- |
* | "Goal deleted" |
*
* @param {Goal_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_deleted = /** @type {((inputs?: Goal_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Goal_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_goal_deleted(inputs)
	return zh_goal_deleted(inputs)
});