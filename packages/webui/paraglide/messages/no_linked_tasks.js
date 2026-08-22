/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Linked_TasksInputs */

const en_no_linked_tasks = /** @type {(inputs: No_Linked_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No tasks linked to this asset`)
};

const zh_no_linked_tasks = /** @type {(inputs: No_Linked_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`该资产暂无关联任务`)
};

/**
* | output |
* | --- |
* | "No tasks linked to this asset" |
*
* @param {No_Linked_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_linked_tasks = /** @type {((inputs?: No_Linked_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Linked_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_linked_tasks(inputs)
	return zh_no_linked_tasks(inputs)
});