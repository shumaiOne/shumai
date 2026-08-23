/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Linked_TasksInputs */

const en_linked_tasks = /** @type {(inputs: Linked_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Linked Tasks`)
};

const zh_linked_tasks = /** @type {(inputs: Linked_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`关联任务`)
};

/**
* | output |
* | --- |
* | "Linked Tasks" |
*
* @param {Linked_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const linked_tasks = /** @type {((inputs?: Linked_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Linked_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_linked_tasks(inputs)
	return zh_linked_tasks(inputs)
});