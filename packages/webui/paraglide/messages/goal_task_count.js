/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Goal_Task_CountInputs */

const en_goal_task_count = /** @type {(inputs: Goal_Task_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} tasks`)
};

const zh_goal_task_count = /** @type {(inputs: Goal_Task_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个任务`)
};

/**
* | output |
* | --- |
* | "{count} tasks" |
*
* @param {Goal_Task_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_task_count = /** @type {((inputs: Goal_Task_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Goal_Task_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_goal_task_count(inputs)
	return zh_goal_task_count(inputs)
});