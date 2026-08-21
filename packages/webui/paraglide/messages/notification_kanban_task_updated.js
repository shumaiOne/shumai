/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, task: NonNullable<unknown> }} Notification_Kanban_Task_UpdatedInputs */

const en_notification_kanban_task_updated = /** @type {(inputs: Notification_Kanban_Task_UpdatedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} updated task ${i?.task}`)
};

const zh_notification_kanban_task_updated = /** @type {(inputs: Notification_Kanban_Task_UpdatedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} 更新了任务 ${i?.task}`)
};

/**
* | output |
* | --- |
* | "{creator} updated task {task}" |
*
* @param {Notification_Kanban_Task_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_updated = /** @type {((inputs: Notification_Kanban_Task_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Kanban_Task_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notification_kanban_task_updated(inputs)
	return zh_notification_kanban_task_updated(inputs)
});