// Ensure Mermaid renders on Material's instant-navigation page loads
document$.subscribe(function() {
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: document.body.getAttribute("data-md-color-scheme") === "slate" ? "dark" : "default",
      themeVariables: { primaryColor: "#0F5B5A", primaryTextColor: "#fff", lineColor: "#C98A0B" }
    });
    window.mermaid.run({ querySelector: ".mermaid" });
  }
});
