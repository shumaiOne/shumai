/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Feature_MetadataInputs */

const en_auth_feature_metadata = /** @type {(inputs: Auth_Feature_MetadataInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Custom metadata schemas & drawing canvas reviews`)
};

const zh_auth_feature_metadata = /** @type {(inputs: Auth_Feature_MetadataInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自定义元数据模式 & 画布标注审阅`)
};

/**
* | output |
* | --- |
* | "Custom metadata schemas & drawing canvas reviews" |
*
* @param {Auth_Feature_MetadataInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const auth_feature_metadata = /** @type {((inputs?: Auth_Feature_MetadataInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Feature_MetadataInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_auth_feature_metadata(inputs)
	return zh_auth_feature_metadata(inputs)
});