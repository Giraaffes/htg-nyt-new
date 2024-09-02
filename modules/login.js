import { Module } from "#root/modules.js";
export const module = new Module();

import { streamToString } from "#root/util.js";


// (R) Lectio proxy

module.proxy("GET /embed/login", 
	"https://www.lectio.dk/lectio/36/login.aspx",
	req => {
		// Page redirects if old SessionId is sent, so don't
		delete req.cookies["ASP.NET_SessionId"];
		return req;
	},
	async (resData, req, res, next) => {
		let html = await streamToString(resData);
		html = html.replace(/(?=<\/head>)/, 
			"<link rel=\"stylesheet\" href=\"/static/css/inject/login.css\">"
		);
		return html;
	}
);
module.proxy({
	path: /^(?!\/static\/)/, method: "GET",
	referer: /\/embed\/login|\/lectio/
}, 
	req => `https://www.lectio.dk${req.url}`
);


// (O) Login

import axios from "axios";

module.route("POST /embed/login.aspx", async (req, res, next) => {
	delete req.headers["host"];
	let loginRes = await axios.post(
		"https://www.lectio.dk/lectio/36/login.aspx", req, {
		headers: req.headers,
		validateStatus: () => true
	});
	if (loginRes.request.path == "/lectio/36/forside.aspx") {
		res.send(loginRes.data.match(/(eleven|læreren) (.+?),/i).slice(1, 3).join(", "));
	} else {
		res.send("not ok :(");
	}
});