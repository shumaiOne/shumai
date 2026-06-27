/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Contains_Drawing_AnnotationsInputs */

const en_contains_drawing_annotations = /** @type {(inputs: Contains_Drawing_AnnotationsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Contains drawing annotations`)
};

const zh_contains_drawing_annotations = /** @type {(inputs: Contains_Drawing_AnnotationsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`包含绘图标注`)
};

/**
* | output |
* | --- |
* | "Contains drawing annotations" |
*
* @param {Contains_Drawing_AnnotationsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const contains_drawing_annotations = /** @type {((inputs?: Contains_Drawing_AnnotationsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Contains_Drawing_AnnotationsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_contains_drawing_annotations(inputs)
	return zh_contains_drawing_annotations(inputs)
});