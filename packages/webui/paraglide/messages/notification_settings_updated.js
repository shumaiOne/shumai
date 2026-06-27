/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notification_Settings_UpdatedInputs */

const en_notification_settings_updated = /** @type {(inputs: Notification_Settings_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Notification settings updated`)
};

const zh_notification_settings_updated = /** @type {(inputs: Notification_Settings_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`通知设置已更新`)
};

/**
* | output |
* | --- |
* | "Notification settings updated" |
*
* @param {Notification_Settings_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_settings_updated = /** @type {((inputs?: Notification_Settings_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Settings_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notification_settings_updated(inputs)
	return zh_notification_settings_updated(inputs)
});