/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Tasks_SingularInputs */

const en_n_tasks_singular = /** @type {(inputs: N_Tasks_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} task`)
};

const zh_n_tasks_singular = /** @type {(inputs: N_Tasks_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个任务`)
};

/**
* | output |
* | --- |
* | "{count} task" |
*
* @param {N_Tasks_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_tasks_singular = /** @type {((inputs: N_Tasks_SingularInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Tasks_SingularInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_tasks_singular(inputs)
	return zh_n_tasks_singular(inputs)
});