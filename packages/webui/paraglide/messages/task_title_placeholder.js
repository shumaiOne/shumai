/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_Title_PlaceholderInputs */

const en_task_title_placeholder = /** @type {(inputs: Task_Title_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What needs to be done?`)
};

const zh_task_title_placeholder = /** @type {(inputs: Task_Title_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`需要完成什么任务？`)
};

/**
* | output |
* | --- |
* | "What needs to be done?" |
*
* @param {Task_Title_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_title_placeholder = /** @type {((inputs?: Task_Title_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_Title_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_title_placeholder(inputs)
	return zh_task_title_placeholder(inputs)
});