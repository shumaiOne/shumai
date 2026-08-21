/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, task: NonNullable<unknown> }} Notification_Kanban_Task_CreatedInputs */

const en_notification_kanban_task_created = /** @type {(inputs: Notification_Kanban_Task_CreatedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} created task ${i?.task}`)
};

const zh_notification_kanban_task_created = /** @type {(inputs: Notification_Kanban_Task_CreatedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} 创建了任务 ${i?.task}`)
};

/**
* | output |
* | --- |
* | "{creator} created task {task}" |
*
* @param {Notification_Kanban_Task_CreatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_created = /** @type {((inputs: Notification_Kanban_Task_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Kanban_Task_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notification_kanban_task_created(inputs)
	return zh_notification_kanban_task_created(inputs)
});