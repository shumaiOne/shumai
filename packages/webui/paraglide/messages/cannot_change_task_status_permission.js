/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Cannot_Change_Task_Status_PermissionInputs */

const en_cannot_change_task_status_permission = /** @type {(inputs: Cannot_Change_Task_Status_PermissionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Only team owners, task reporters, or assignees can change task status`)
};

const zh_cannot_change_task_status_permission = /** @type {(inputs: Cannot_Change_Task_Status_PermissionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`仅团队所有者、任务报告人或负责人可以修改任务状态`)
};

/**
* | output |
* | --- |
* | "Only team owners, task reporters, or assignees can change task status" |
*
* @param {Cannot_Change_Task_Status_PermissionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cannot_change_task_status_permission = /** @type {((inputs?: Cannot_Change_Task_Status_PermissionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cannot_Change_Task_Status_PermissionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_cannot_change_task_status_permission(inputs)
	return zh_cannot_change_task_status_permission(inputs)
});