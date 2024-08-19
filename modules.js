import axios from "axios";
import { Stream, PassThrough } from "stream";


// From https://expressjs.com/en/4x/api.html#routing-methods
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
		
		// if (!this.match.specific && !this.match.path.endsWith("*")) {
		// 	let unspecificPath = this.match.path;
		// 	if (!unspecificPath.endsWith("/")) unspecificPath += "/";
		// 	unspecificPath += "*";
		// 	this.match.path = [this.match.path, unspecificPath];
		// }
	}

	checkHeaders(req, res, next) {
		let { method, path, specific, ...headers } = this.match;
		let doHeadersMatch = Object.entries(headers).every(([ h, v ]) => 
			req.get(h) && v instanceof RegExp ? req.get(h).match(v) : req.get(h) == v
		);
		if (doHeadersMatch) { next(); } else { next("route"); }
	}

	use(server, database) {
		server[this.match.method](this.match.path, 
			this.checkHeaders.bind(this),
			...this.middleHandlers, 
			(req, res, next) => this.mainHandler(req, res, next, database) // todo do i need to add await/async??
		);
	}
}

class ProxyRoute extends Route {
	constructor(match, proxyUrl, handlers) {
		super(match, handlers);

		this.proxyUrl = proxyUrl;
		
		this.middleHandlers = handlers.slice(0, -2);
		this.mainHandler = this.proxyHandler;
		
		this.preHandler = this.handlers[this.middleHandlers.length];
		this.postHandler = this.handlers[this.middleHandlers.length + 1];
	}

	async proxyHandler(req, res, next, database) {
		// todo is this necessary?
		delete req.headers["host"];
		delete req.headers["content-length"];

		// uhh guess i gotta be careful (https://github.com/advisories/GHSA-8hc4-vh64-cxmj)
		let proxyUrl = (typeof this.proxyUrl == "function") ? this.proxyUrl(req) : this.proxyUrl;
		let reqData = this.preHandler ? this.preHandler(req, res, next) : req;
		let proxyRes = await axios({
			url: proxyUrl,
			method: req.method,
			headers: req.headers,
			data: reqData,
			responseType: "stream",
			maxRedirects: 0,
			validateStatus: () => true
		});
		let resData = this.postHandler ? this.postHandler(proxyRes.data, req, res, next) : proxyRes.data;

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

export class Module {
	init = function() {};
	routes = [];

	onInit(handler) {
		this.init = handler;
	}

	route(options, ...handlers) {
		this.routes.push(new Route(options, handlers));
	}

	proxy(options, proxyUrl, ...handlers) {
		this.routes.push(new ProxyRoute(options, proxyUrl, handlers));
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