import axios from "axios";
import { Stream } from "stream";
import beautify from "js-beautify";
import * as cheerio from "cheerio";

import { escapeRegex, concatRegex, cookieString } from "#root/util.js";

import config from "#root/config.json" assert {type: "json"};


// (R) Custom render function
function reorderStylesAndScripts(html) {
	let $ = cheerio.load(html);
	$(" body link[rel=stylesheet]").appendTo("head");
	$(" body script").appendTo("body");
	return $.html();
}

function render(res, view, ...args) {
	let callbackArg = args.find(a => typeof a == "function");
	if (callbackArg) args.splice(args.indexOf(callbackArg), 1);
	
	res.render(view, ...args, (err, html) => {
		if (!err) {
			html = reorderStylesAndScripts(html);
			html = beautify.html(html, config.htmlBeautifier);
		}
		if (callbackArg) {
			callbackArg(err, html);
		} else {
			if (err) { next(err); } else { res.send(html); }
		}
	});
}


// (O) Routes

// https://expressjs.com/en/4x/api.html#routing-methods
const HTTPMethods = ["checkout", "copy", "delete", "get", "head", "lock", "merge", "mkactivity", "mkcol", "move", "m-search", "notify", "options", "patch", "post", "purge", "put", "report", "search", "subscribe", "trace", "unlock", "unsubscribe"];

class Route {
	constructor(match, handlers) {
		this.match = match;
		this.handlers = handlers;

		this.formatMatch();
		
		this.middleHandlers = handlers.slice(0, -1);
		this.mainHandler = handlers[handlers.length - 1];
	}

	formatMatch() {
		if (typeof this.match == "string") {
			let matchStr = this.match;
			this.match = {};

			matchStr = matchStr.trim();
			this.match.method = HTTPMethods.find(m => matchStr.toLowerCase().startsWith(m));
			if (this.match.method) matchStr = matchStr.slice(this.match.method.length).trim();
			if (matchStr.length > 0) this.match.path = matchStr;
		}

		this.match.method = (this.match.method || "all").toLowerCase();
		this.match.path = this.match.path || "/*";
		
		if (this.match.referer) {
			if (this.match.referer instanceof RegExp) {
				this.match.referer = concatRegex(
					/^https?:\/\/.+?/, this.match.referer, /\/|\?|$/
				);
			} else {
				let pathRegex = escapeRegex(this.match.referer).replaceAll("\\*", ".+");
				this.match.referer = new RegExp(
					`^https?://.+?${pathRegex}(?:\/|\?|$)`
				);
			}
		}
	}

	checkHeaders(req, res, next) {
		let { method, path, ...headers } = this.match;
		let doHeadersMatch = Object.entries(headers).every(([ h, v ]) => 
			req.get(h) && v instanceof RegExp ? req.get(h).match(v) : req.get(h) == v
		);
		if (doHeadersMatch) { next(); } else { next("route"); }
	}

	use(server, database) {
		server[this.match.method](this.match.path, 
			this.checkHeaders.bind(this),
			...this.middleHandlers, 
			(req, res, next) => this.mainHandler(
				req, res, next, render.bind(null, res), database
			)
		);
	}
}


// (Y) Proxy routes

class ProxyRoute extends Route {
	constructor(match, proxyUrl, handlers) {
		super(match, handlers);

		this.proxyUrl = proxyUrl;
		
		this.middleHandlers = handlers.slice(0, -2);
		this.mainHandler = this.proxyHandler;
		
		this.preHandler = this.handlers[this.middleHandlers.length];
		this.postHandler = this.handlers[this.middleHandlers.length + 1];
	}

	async proxyHandler(req, res, next) {
		// Necessary
		delete req.headers["host"];

		// Axios should set content-length
		delete req.headers["content-length"];
		
		// Pre-request handler (allow for modifying cookies)
		let reqData = this.preHandler ? this.preHandler(req, res, next) : req;
		req.headers["cookie"] = cookieString(req.cookies);

		// Uhh guess i gotta be careful (https://github.com/advisories/GHSA-8hc4-vh64-cxmj)
		let proxyUrl = (typeof this.proxyUrl == "function") ? await this.proxyUrl(req) : this.proxyUrl;
		let proxyRes = await axios({
			url: proxyUrl,
			method: req.method,
			headers: req.headers,
			data: reqData,
			responseType: "stream",
			maxRedirects: 0,
			validateStatus: () => true
		});

		// Post-request handler
		let resData = this.postHandler ? await this.postHandler(proxyRes.data, req, res, next) : proxyRes.data;
		
		// No redirects
		delete proxyRes.headers["location"];

		// To fix a glitch (I think) where nginx complains when both transfer-encoding and content-length are sent
		delete proxyRes.headers["transfer-encoding"];

		// Sometimes the content-length is set incorrectly and the stream is ended prematurely (by Axios or Express idk)
		delete proxyRes.headers["content-length"];

		res.status(proxyRes.status);
		res.statusMessage = proxyRes.statusText;
		res.set(proxyRes.headers);
		if (resData instanceof Stream) {
			resData.pipe(res);
		} else {
			res.send(resData);
		}
	}
}


// (G) Module registry

export class Module {
	init = function() {};
	routes = [];

	onInit(handler) {
		this.init = handler;
	}

	route(match, ...handlers) {
		this.routes.push(new Route(match, handlers));
	}

	proxy(match, proxyUrl, ...handlers) {
		this.routes.push(new ProxyRoute(match, proxyUrl, handlers));
	}
};


let modules = [];
export let count = 0;

export async function register(moduleName) {
	let { module } = await import(`./modules/${moduleName}.js`);
	if (module) {
		modules.push(module);
		count++;
	}
};

export async function init(database) {
	for (let m of modules) {
		await m.init(database);
	}
};

export function useRoutes(server, database) {
	let routes = modules.flatMap(m => m.routes);
	for (let r of routes) {
		r.use(server, database);
	}
}