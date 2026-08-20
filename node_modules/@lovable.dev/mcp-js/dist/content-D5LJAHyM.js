//#region src/core/content.ts
/** Join the text of a result's `type: "text"` blocks into one string, dropping
*  binary/resource blocks. Used to surface a `tool_error` message in the local
*  log; never sent over the telemetry wire. Returns undefined when there is no
*  text to show. */
function extractTextContent(content) {
	if (!content) return void 0;
	const text = content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
	return text.length > 0 ? text : void 0;
}
//#endregion
export { extractTextContent as t };
