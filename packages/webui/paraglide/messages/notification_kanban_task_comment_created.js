/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, task: NonNullable<unknown> }} Notification_Kanban_Task_Comment_CreatedInputs */

const en_notification_kanban_task_comment_created = /** @type {(inputs: Notification_Kanban_Task_Comment_CreatedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} commented on task ${i?.task}`)
};

const zh_notification_kanban_task_comment_created = /** @type {(inputs: Notification_Kanban_Task_Comment_CreatedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} 评论了任务 ${i?.task}`)
};

/**
* | output |
* | --- |
* | "{creator} commented on task {task}" |
*
* @param {Notification_Kanban_Task_Comment_CreatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_comment_created = /** @type {((inputs: Notification_Kanban_Task_Comment_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Kanban_Task_Comment_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notification_kanban_task_comment_created(inputs)
	return zh_notification_kanban_task_comment_created(inputs)
});