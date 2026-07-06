/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} EditorInputs */

const en_editor = /** @type {(inputs: EditorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Editor`)
};

const zh_editor = /** @type {(inputs: EditorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创作者`)
};

/**
* | output |
* | --- |
* | "Editor" |
*
* @param {EditorInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const editor = /** @type {((inputs?: EditorInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<EditorInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_editor(inputs)
	return zh_editor(inputs)
});