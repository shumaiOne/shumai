/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} When_Kanban_Task_CommentedInputs */

const en_when_kanban_task_commented = /** @type {(inputs: When_Kanban_Task_CommentedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`When someone comments on a task`)
};

const zh_when_kanban_task_commented = /** @type {(inputs: When_Kanban_Task_CommentedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`当有人在任务中发表评论时`)
};

/**
* | output |
* | --- |
* | "When someone comments on a task" |
*
* @param {When_Kanban_Task_CommentedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const when_kanban_task_commented = /** @type {((inputs?: When_Kanban_Task_CommentedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<When_Kanban_Task_CommentedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_when_kanban_task_commented(inputs)
	return zh_when_kanban_task_commented(inputs)
});