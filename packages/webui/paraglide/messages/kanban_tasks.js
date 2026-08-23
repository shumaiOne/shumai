/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Kanban_TasksInputs */

const en_kanban_tasks = /** @type {(inputs: Kanban_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Kanban Tasks`)
};

const zh_kanban_tasks = /** @type {(inputs: Kanban_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`看板任务`)
};

/**
* | output |
* | --- |
* | "Kanban Tasks" |
*
* @param {Kanban_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_tasks = /** @type {((inputs?: Kanban_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Kanban_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_kanban_tasks(inputs)
	return zh_kanban_tasks(inputs)
});