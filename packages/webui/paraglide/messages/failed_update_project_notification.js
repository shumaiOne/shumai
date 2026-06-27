/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Update_Project_NotificationInputs */

const en_failed_update_project_notification = /** @type {(inputs: Failed_Update_Project_NotificationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update project notification settings`)
};

const zh_failed_update_project_notification = /** @type {(inputs: Failed_Update_Project_NotificationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新项目通知设置失败`)
};

/**
* | output |
* | --- |
* | "Failed to update project notification settings" |
*
* @param {Failed_Update_Project_NotificationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_project_notification = /** @type {((inputs?: Failed_Update_Project_NotificationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Update_Project_NotificationInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_update_project_notification(inputs)
	return zh_failed_update_project_notification(inputs)
});