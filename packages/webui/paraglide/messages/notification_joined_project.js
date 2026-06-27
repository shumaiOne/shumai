/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ user: NonNullable<unknown>, project: NonNullable<unknown> }} Notification_Joined_ProjectInputs */

const en_notification_joined_project = /** @type {(inputs: Notification_Joined_ProjectInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.user} joined ${i?.project}`)
};

const zh_notification_joined_project = /** @type {(inputs: Notification_Joined_ProjectInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.user} 加入了 ${i?.project}`)
};

/**
* | output |
* | --- |
* | "{user} joined {project}" |
*
* @param {Notification_Joined_ProjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_joined_project = /** @type {((inputs: Notification_Joined_ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Joined_ProjectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notification_joined_project(inputs)
	return zh_notification_joined_project(inputs)
});