/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ title: NonNullable<unknown> }} Delete_Task_ConfirmInputs */

const en_delete_task_confirm = /** @type {(inputs: Delete_Task_ConfirmInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Are you sure you want to delete task "${i?.title}"? This action cannot be undone.`)
};

const zh_delete_task_confirm = /** @type {(inputs: Delete_Task_ConfirmInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`确定要删除任务"${i?.title}"吗？此操作无法撤销。`)
};

/**
* | output |
* | --- |
* | "Are you sure you want to delete task \"{title}\"? This action cannot be undone." |
*
* @param {Delete_Task_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_task_confirm = /** @type {((inputs: Delete_Task_ConfirmInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Task_ConfirmInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_task_confirm(inputs)
	return zh_delete_task_confirm(inputs)
});