/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Linked_Tasks_CountInputs */

const en_linked_tasks_count = /** @type {(inputs: Linked_Tasks_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} tasks`)
};

const zh_linked_tasks_count = /** @type {(inputs: Linked_Tasks_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个任务`)
};

/**
* | output |
* | --- |
* | "{count} tasks" |
*
* @param {Linked_Tasks_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const linked_tasks_count = /** @type {((inputs: Linked_Tasks_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Linked_Tasks_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_linked_tasks_count(inputs)
	return zh_linked_tasks_count(inputs)
});