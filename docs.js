
import { google as gApis, Auth as gAuthLib } from "googleapis";

let drive, docs;


export async function connect(credentials) {
	// https://stackoverflow.com/a/72620734/26806091
	let auth = await (new gAuthLib.GoogleAuth({
		credentials, scopes: ["https://www.googleapis.com/auth/drive"]
	})).getClient();

	drive = await gApis.drive({version: "v3", auth}); // Do I need Drive?
	docs = await gApis.docs({version: "v1", auth});
}

export async function getDocument(documentId) {
	let res = await docs.documents.get({documentId});
	return {
		content: res.data.body.content, 
		inlineObjects: res.data.inlineObjects
	};
}