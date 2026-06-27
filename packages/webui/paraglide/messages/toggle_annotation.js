/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Toggle_AnnotationInputs */

const en_toggle_annotation = /** @type {(inputs: Toggle_AnnotationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Toggle Annotation`)
};

const zh_toggle_annotation = /** @type {(inputs: Toggle_AnnotationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`切换标注`)
};

/**
* | output |
* | --- |
* | "Toggle Annotation" |
*
* @param {Toggle_AnnotationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const toggle_annotation = /** @type {((inputs?: Toggle_AnnotationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Toggle_AnnotationInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_toggle_annotation(inputs)
	return zh_toggle_annotation(inputs)
});