/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notifications_DescriptionInputs */

const en_notifications_description = /** @type {(inputs: Notifications_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure your personal notification preferences for this team.`)
};

const zh_notifications_description = /** @type {(inputs: Notifications_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配置您在此团队的个人通知偏好。`)
};

/**
* | output |
* | --- |
* | "Configure your personal notification preferences for this team." |
*
* @param {Notifications_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notifications_description = /** @type {((inputs?: Notifications_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notifications_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notifications_description(inputs)
	return zh_notifications_description(inputs)
});