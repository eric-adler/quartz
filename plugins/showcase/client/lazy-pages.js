// Pages whose code is too heavy to ship site-wide: their modules load only when the page is opened.
const sc = window.showcase

sc.onPageLazy("shaders", "shaders")
sc.onPageLazy("hover-lab", "hoverlab")
sc.onPageLazy("semantic-map", "semantic-map")
