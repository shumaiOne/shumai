/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, task: NonNullable<unknown> }} Notification_Kanban_Task_DeletedInputs */

const en_notification_kanban_task_deleted = /** @type {(inputs: Notification_Kanban_Task_DeletedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} deleted task ${i?.task}`)
};

const zh_notification_kanban_task_deleted = /** @type {(inputs: Notification_Kanban_Task_DeletedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} 删除了任务 ${i?.task}`)
};

/**
* | output |
* | --- |
* | "{creator} deleted task {task}" |
*
* @param {Notification_Kanban_Task_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_deleted = /** @type {((inputs: Notification_Kanban_Task_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Kanban_Task_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notification_kanban_task_deleted(inputs)
	return zh_notification_kanban_task_deleted(inputs)
});