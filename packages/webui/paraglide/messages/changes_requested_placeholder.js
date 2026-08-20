/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Changes_Requested_PlaceholderInputs */

const en_changes_requested_placeholder = /** @type {(inputs: Changes_Requested_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Explain what needs to be changed before this task can be accepted...`)
};

const zh_changes_requested_placeholder = /** @type {(inputs: Changes_Requested_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`说明在接受此任务之前需要修改的内容...`)
};

/**
* | output |
* | --- |
* | "Explain what needs to be changed before this task can be accepted..." |
*
* @param {Changes_Requested_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const changes_requested_placeholder = /** @type {((inputs?: Changes_Requested_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Changes_Requested_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_changes_requested_placeholder(inputs)
	return zh_changes_requested_placeholder(inputs)
});