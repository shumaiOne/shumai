/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_Notification_UpdatedInputs */

const en_project_notification_updated = /** @type {(inputs: Project_Notification_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Project notification settings updated`)
};

const zh_project_notification_updated = /** @type {(inputs: Project_Notification_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目通知设置已更新`)
};

/**
* | output |
* | --- |
* | "Project notification settings updated" |
*
* @param {Project_Notification_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_notification_updated = /** @type {((inputs?: Project_Notification_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_Notification_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_notification_updated(inputs)
	return zh_project_notification_updated(inputs)
});