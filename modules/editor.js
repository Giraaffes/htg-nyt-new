import { Module } from "#root/modules.js";
export const module = new Module();

import { PassThrough } from "stream";


module.proxy("GET /docs/:id", 
	req => `https://docs.google.com/document/d/${req.params.id}/edit`
);


function hookDocsEvent(type, id, event) {
	if (type == 5) event.displayName = "test";
	return event;
}

function hookDocsBind(inStream, outStream) {
	let msgLength;
	let data = "";
	inStream.on("data", chunk => {
		data += chunk.toString();

		let msgLengthStr;
		if (!msgLength && (msgLengthStr = (data.match(/^(\d+)\n/) || [])[1])) {
			data = data.slice(msgLengthStr.length + 1);
			msgLength = parseInt(msgLengthStr);
		}

		if (msgLength && data.length >= msgLength) {
			let msg = JSON.parse(data.slice(0, msgLength));
			msg = msg.map(([i, eventData]) => {
				if (typeof eventData[0] == "number") {
					let [ type, id, event] = eventData;
					return [i, [type, id, hookDocsEvent(type, id, event)]];
				} else {
					return [i, eventData];
				}
			});

			let msgStr = JSON.stringify(msg);
			outStream.write(Buffer.from(`${msgStr.length}\n${msgStr}`));

			data = data.slice(msgLength);
			msgLength = null;
		}
	});
}

module.proxy({referer: /\/docs\/.+/}, 
	req => `https://docs.google.com${req.url}`,
	null, (inStream, req) => {
		if (req.path.endsWith("/bind")) {
			let outStream = new PassThrough();
			inStream.on("end", () => outStream.end());
			hookDocsBind(inStream, outStream);
			return outStream;
		} else {
			return inStream;
		}
	}
);