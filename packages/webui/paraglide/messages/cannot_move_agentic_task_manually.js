/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Cannot_Move_Agentic_Task_ManuallyInputs */

const en_cannot_move_agentic_task_manually = /** @type {(inputs: Cannot_Move_Agentic_Task_ManuallyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Agentic tasks are claimed automatically by the agent dispatcher`)
};

const zh_cannot_move_agentic_task_manually = /** @type {(inputs: Cannot_Move_Agentic_Task_ManuallyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体任务由调度器自动认领执行`)
};

/**
* | output |
* | --- |
* | "Agentic tasks are claimed automatically by the agent dispatcher" |
*
* @param {Cannot_Move_Agentic_Task_ManuallyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cannot_move_agentic_task_manually = /** @type {((inputs?: Cannot_Move_Agentic_Task_ManuallyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cannot_Move_Agentic_Task_ManuallyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_cannot_move_agentic_task_manually(inputs)
	return zh_cannot_move_agentic_task_manually(inputs)
});