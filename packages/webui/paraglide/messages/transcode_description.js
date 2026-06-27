/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Transcode_DescriptionInputs */

const en_transcode_description = /** @type {(inputs: Transcode_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage your team's media transcoding configurations.`)
};

const zh_transcode_description = /** @type {(inputs: Transcode_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理团队的媒体转码配置。`)
};

/**
* | output |
* | --- |
* | "Manage your team's media transcoding configurations." |
*
* @param {Transcode_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const transcode_description = /** @type {((inputs?: Transcode_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Transcode_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_transcode_description(inputs)
	return zh_transcode_description(inputs)
});