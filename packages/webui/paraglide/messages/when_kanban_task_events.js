/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} When_Kanban_Task_EventsInputs */

const en_when_kanban_task_events = /** @type {(inputs: When_Kanban_Task_EventsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`When tasks are created, assigned, updated, or deleted`)
};

const zh_when_kanban_task_events = /** @type {(inputs: When_Kanban_Task_EventsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`当任务被创建、分配、更新或删除时`)
};

/**
* | output |
* | --- |
* | "When tasks are created, assigned, updated, or deleted" |
*
* @param {When_Kanban_Task_EventsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const when_kanban_task_events = /** @type {((inputs?: When_Kanban_Task_EventsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<When_Kanban_Task_EventsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_when_kanban_task_events(inputs)
	return zh_when_kanban_task_events(inputs)
});