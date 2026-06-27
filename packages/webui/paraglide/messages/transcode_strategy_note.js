/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Transcode_Strategy_NoteInputs */

const en_transcode_strategy_note = /** @type {(inputs: Transcode_Strategy_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Strategy: We select the best resolution from your list that supports the input quality. Content is never upscaled.`)
};

const zh_transcode_strategy_note = /** @type {(inputs: Transcode_Strategy_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`策略：我们会从您的列表中选择支持输入质量的最佳分辨率。内容不会被放大。`)
};

/**
* | output |
* | --- |
* | "Strategy: We select the best resolution from your list that supports the input quality. Content is never upscaled." |
*
* @param {Transcode_Strategy_NoteInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const transcode_strategy_note = /** @type {((inputs?: Transcode_Strategy_NoteInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Transcode_Strategy_NoteInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_transcode_strategy_note(inputs)
	return zh_transcode_strategy_note(inputs)
});