/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofilling_MetadataInputs */

const en_autofilling_metadata = /** @type {(inputs: Autofilling_MetadataInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Autofilling metadata...`)
};

const zh_autofilling_metadata = /** @type {(inputs: Autofilling_MetadataInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正在自动填充元数据...`)
};

/**
* | output |
* | --- |
* | "Autofilling metadata..." |
*
* @param {Autofilling_MetadataInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofilling_metadata = /** @type {((inputs?: Autofilling_MetadataInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofilling_MetadataInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofilling_metadata(inputs)
	return zh_autofilling_metadata(inputs)
});