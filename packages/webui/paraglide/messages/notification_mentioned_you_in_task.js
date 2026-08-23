/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, task: NonNullable<unknown> }} Notification_Mentioned_You_In_TaskInputs */

const en_notification_mentioned_you_in_task = /** @type {(inputs: Notification_Mentioned_You_In_TaskInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} mentioned you in task ${i?.task}`)
};

const zh_notification_mentioned_you_in_task = /** @type {(inputs: Notification_Mentioned_You_In_TaskInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} 在任务 ${i?.task} 中提及了你`)
};

/**
* | output |
* | --- |
* | "{creator} mentioned you in task {task}" |
*
* @param {Notification_Mentioned_You_In_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_mentioned_you_in_task = /** @type {((inputs: Notification_Mentioned_You_In_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Mentioned_You_In_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notification_mentioned_you_in_task(inputs)
	return zh_notification_mentioned_you_in_task(inputs)
});