/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Kanban_Notification_DescriptionInputs */

const en_kanban_notification_description = /** @type {(inputs: Kanban_Notification_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage notifications for Kanban board tasks and comments.`)
};

const zh_kanban_notification_description = /** @type {(inputs: Kanban_Notification_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理看板任务和评论相关的通知偏好。`)
};

/**
* | output |
* | --- |
* | "Manage notifications for Kanban board tasks and comments." |
*
* @param {Kanban_Notification_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_notification_description = /** @type {((inputs?: Kanban_Notification_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Kanban_Notification_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_kanban_notification_description(inputs)
	return zh_kanban_notification_description(inputs)
});