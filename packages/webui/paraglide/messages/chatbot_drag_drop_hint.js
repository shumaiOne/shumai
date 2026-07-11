/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chatbot_Drag_Drop_HintInputs */

const en_chatbot_drag_drop_hint = /** @type {(inputs: Chatbot_Drag_Drop_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Drag and drop files or folders here to add them to chatbot context`)
};

const zh_chatbot_drag_drop_hint = /** @type {(inputs: Chatbot_Drag_Drop_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`拖拽文件或文件夹到此处以添加到聊天机器人上下文`)
};

/**
* | output |
* | --- |
* | "Drag and drop files or folders here to add them to chatbot context" |
*
* @param {Chatbot_Drag_Drop_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_drag_drop_hint = /** @type {((inputs?: Chatbot_Drag_Drop_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chatbot_Drag_Drop_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chatbot_drag_drop_hint(inputs)
	return zh_chatbot_drag_drop_hint(inputs)
});