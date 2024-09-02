// https://stackoverflow.com/a/3561711/26806091
export function escapeRegex(str) {
	return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

export function concatRegex(...args) { // Assumes no flags
	return new RegExp(args.reduce(
		(a, v) => a + `(?:${v.source})`, ""
	));
}

export function cookieString(cookies) {
	return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join(";");
}

// https://stackoverflow.com/a/49428486/26806091
export function streamToString(stream) {
  let chunks = [];
  return new Promise((res, rej) => {
    stream.on("data", chunk => chunks.push(Buffer.from(chunk)));
    stream.on("error", rej);
    stream.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
  });
}