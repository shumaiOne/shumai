/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_Has_Unmet_DependenciesInputs */

const en_task_has_unmet_dependencies = /** @type {(inputs: Task_Has_Unmet_DependenciesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Task cannot be moved because prerequisite dependencies are not done`)
};

const zh_task_has_unmet_dependencies = /** @type {(inputs: Task_Has_Unmet_DependenciesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`任务无法移动，因为前置依赖尚未完成`)
};

/**
* | output |
* | --- |
* | "Task cannot be moved because prerequisite dependencies are not done" |
*
* @param {Task_Has_Unmet_DependenciesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_has_unmet_dependencies = /** @type {((inputs?: Task_Has_Unmet_DependenciesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_Has_Unmet_DependenciesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_has_unmet_dependencies(inputs)
	return zh_task_has_unmet_dependencies(inputs)
});