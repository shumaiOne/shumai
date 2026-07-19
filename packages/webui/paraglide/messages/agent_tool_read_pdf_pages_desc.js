/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Read_Pdf_Pages_DescInputs */

const en_agent_tool_read_pdf_pages_desc = /** @type {(inputs: Agent_Tool_Read_Pdf_Pages_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allows the agent to convert and view specific pages of a PDF document as images.`)
};

const zh_agent_tool_read_pdf_pages_desc = /** @type {(inputs: Agent_Tool_Read_Pdf_Pages_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许智能体将 PDF 文件的指定页面转换为图片并查看。`)
};

/**
* | output |
* | --- |
* | "Allows the agent to convert and view specific pages of a PDF document as images." |
*
* @param {Agent_Tool_Read_Pdf_Pages_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_read_pdf_pages_desc = /** @type {((inputs?: Agent_Tool_Read_Pdf_Pages_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Read_Pdf_Pages_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_read_pdf_pages_desc(inputs)
	return zh_agent_tool_read_pdf_pages_desc(inputs)
});