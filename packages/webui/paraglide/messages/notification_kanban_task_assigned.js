/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, task: NonNullable<unknown> }} Notification_Kanban_Task_AssignedInputs */

const en_notification_kanban_task_assigned = /** @type {(inputs: Notification_Kanban_Task_AssignedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} assigned you to task ${i?.task}`)
};

const zh_notification_kanban_task_assigned = /** @type {(inputs: Notification_Kanban_Task_AssignedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} 将任务 ${i?.task} 分配给了你`)
};

/**
* | output |
* | --- |
* | "{creator} assigned you to task {task}" |
*
* @param {Notification_Kanban_Task_AssignedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_assigned = /** @type {((inputs: Notification_Kanban_Task_AssignedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Kanban_Task_AssignedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notification_kanban_task_assigned(inputs)
	return zh_notification_kanban_task_assigned(inputs)
});