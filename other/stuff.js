async function click(el) {
	el.click();
	el.dispatchEvent(new MouseEvent("mousedown", {bubbles: true}));
	el.dispatchEvent(new MouseEvent("mouseup", {bubbles: true}));
}

click($(".navigation-widget-hat-close"));
click($(".goog-menuitem-label[aria-label*=Sideopsætning]"));
click($("#kix-pagesetupdialog-document-mode-toggle-1"));
click($(".kix-pagesetupdialog-modal .goog-buttonset-action"));