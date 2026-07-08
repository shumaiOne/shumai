/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Drop_Files_Here_ContextInputs */

const en_drop_files_here_context = /** @type {(inputs: Drop_Files_Here_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Drop files or folders here as context`)
};

const zh_drop_files_here_context = /** @type {(inputs: Drop_Files_Here_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`拖拽文件或文件夹到此处作为上下文`)
};

/**
* | output |
* | --- |
* | "Drop files or folders here as context" |
*
* @param {Drop_Files_Here_ContextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const drop_files_here_context = /** @type {((inputs?: Drop_Files_Here_ContextInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Drop_Files_Here_ContextInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_drop_files_here_context(inputs)
	return zh_drop_files_here_context(inputs)
});