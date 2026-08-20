/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_Description_PlaceholderInputs */

const en_task_description_placeholder = /** @type {(inputs: Task_Description_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add details, acceptance criteria, or context...`)
};

const zh_task_description_placeholder = /** @type {(inputs: Task_Description_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加详细说明、验收标准或背景信息...`)
};

/**
* | output |
* | --- |
* | "Add details, acceptance criteria, or context..." |
*
* @param {Task_Description_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_description_placeholder = /** @type {((inputs?: Task_Description_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_Description_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_description_placeholder(inputs)
	return zh_task_description_placeholder(inputs)
});