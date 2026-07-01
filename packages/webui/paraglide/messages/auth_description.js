/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_DescriptionInputs */

const en_auth_description = /** @type {(inputs: Auth_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Upload and index your files, enrich them with custom metadata schemas, draw annotations directly on media, and gather instant feedback — all in one modern workspace built for creators.`)
};

const zh_auth_description = /** @type {(inputs: Auth_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传您的创意资产，添加各种类型的自定义元数据，直接在图片或视频上绘制标注和添加评论，——这一切都在Shumai，一个为创作者打造的一站式平台上完成。`)
};

/**
* | output |
* | --- |
* | "Upload and index your files, enrich them with custom metadata schemas, draw annotations directly on media, and gather instant feedback — all in one modern wo..." |
*
* @param {Auth_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const auth_description = /** @type {((inputs?: Auth_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_auth_description(inputs)
	return zh_auth_description(inputs)
});