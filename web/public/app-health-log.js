// App Health browser logs. Public, origin-pinned key; nothing here is secret.
// Logs form submits, clicks on [data-log] elements, and client errors to the
// Logs tab at health.sassmaker.com. window.appHealthLog(event, options) is
// available for custom events. Source: app-health/examples/dropin-log-client.
(() => {
  var KEY = "ahk_pub_df990cae968dae7ec2e6819936c5ab9b1d5251e2d24db478",
    ENV = "production",
    URL = "https://ingest.sassmaker.com/v1/logs";
  function id() {
    return crypto.randomUUID();
  }
  function send(event, o) {
    o = o || {};
    var props = {},
      src = o.props || {};
    for (var k in src)
      if (src[k] !== undefined)
        props[k] = typeof src[k] === "string" ? src[k].slice(0, 500) : src[k];
    var body = JSON.stringify({
      public_key: KEY,
      batch_id: id(),
      schema_version: "v1",
      environment: ENV,
      logs: [
        {
          log_id: id(),
          timestamp: Date.now(),
          event: event,
          level: o.level || "info",
          title: o.title,
          description: o.description,
          icon: o.icon,
          props: props,
        },
      ],
    });
    if (document.visibilityState === "hidden" && navigator.sendBeacon) {
      navigator.sendBeacon(URL, new Blob([body], { type: "text/plain" }));
      return;
    }
    fetch(URL, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: body,
      keepalive: true,
    }).catch(() => {});
  }
  window.appHealthLog = send;
  document.addEventListener(
    "submit",
    (e) => {
      var f = e.target;
      if (f?.tagName !== "FORM") return;
      send("form.submitted", {
        title: f.id || f.getAttribute("name") || f.getAttribute("action") || "form",
        props: { page: location.pathname },
      });
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      var t = e.target?.closest ? e.target.closest("[data-log]") : null;
      var name = t?.getAttribute("data-log");
      if (name)
        send(name, {
          title: (t.textContent || "").trim().slice(0, 120) || name,
          props: { page: location.pathname },
        });
    },
    true,
  );
  window.addEventListener("error", (e) => {
    send("client.error", {
      level: "error",
      title: String(e.message || "error").slice(0, 200),
      props: { page: location.pathname },
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    var r = e.reason?.message ? e.reason.message : String(e.reason);
    send("client.error", {
      level: "error",
      title: r.slice(0, 200),
      props: { page: location.pathname, kind: "rejection" },
    });
  });
})();
