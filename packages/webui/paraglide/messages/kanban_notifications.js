/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Kanban_NotificationsInputs */

const en_kanban_notifications = /** @type {(inputs: Kanban_NotificationsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Kanban Notifications`)
};

const zh_kanban_notifications = /** @type {(inputs: Kanban_NotificationsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`看板通知`)
};

/**
* | output |
* | --- |
* | "Kanban Notifications" |
*
* @param {Kanban_NotificationsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_notifications = /** @type {((inputs?: Kanban_NotificationsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Kanban_NotificationsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_kanban_notifications(inputs)
	return zh_kanban_notifications(inputs)
});