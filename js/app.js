(function () {
    "use strict";

    var REPO = "https://github.com/marc-frank/motor-database";
    var IDENTITY = ["Image", "Manufacturer", "Name", "Link"];

    // Order and grouping of fields in the details panel. Anything not listed lands in "Other".
    var GROUPS = [
        ["Stator", ["Stator Diameter (mm)", "Stator Height (mm)", "Stator Configuration", "Stator Material", "Stator Lamination Thickness (mm)", "Flux Direction", "Flux Ring Thickness (mm)"]],
        ["Electrical", ["KV (RPM/V)", "Internal Resistance (mΩ)", "Winding Type", "Enamel Type", "Magnet Type"]],
        ["Construction", ["Base Type", "Base Material", "Bell Type", "Bell Material"]],
        ["Weight & wiring", ["Weight (incl. Cable) (g)", "Weight (excl. Cable) (g)", "Cable length (mm)", "Cable Gauge (AWG)", "Connector"]],
        ["Shaft", ["Shaft Diameter (external) (mm)", "Shaft Diameter (internal) (mm)", "Shaft Type", "Shaft Material", "Shaft Retention"]],
        ["Bearings", ["Bearing Type", "Bearing Outer Diameter", "Bearing Inner Diameter", "Bearing Thickness"]],
        ["Mounting", ["Mounting Pattern Diameter (mm)", "Number of Mounting Screws", "Mounting Screw Thread"]],
        ["Purchase", ["Price ($)"]],
    ];

    // Columns kept to the left of the spec columns, in this order.
    var LEAD_KEYS = ["KV (RPM/V)", "Price ($)"];

    var MOTOR_ICON =
        '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="currentColor" stroke-width="1.5"/></svg>';
    var EXT_ICON =
        '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>';

    // ---------- helpers ----------

    function $(id) {
        return document.getElementById(id);
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function filled(v) {
        return v != null && String(v).trim() !== "";
    }

    function num(v) {
        if (!filled(v)) return null;
        var n = parseFloat(String(v).replace(",", "."));
        return isFinite(n) ? n : null;
    }

    function isPureNumber(v) {
        return /^\s*-?\d+(\.\d+)?\s*$/.test(String(v));
    }

    function fmtNum(v) {
        if (!filled(v)) return "";
        if (!isPureNumber(v)) return String(v);
        var n = parseFloat(v);
        return String(Math.round(n * 1000) / 1000);
    }

    function splitLabel(key) {
        var m = key.match(/^(.*?)\s*\(([^()]*)\)$/);
        return m ? { label: m[1], unit: m[2] } : { label: key, unit: "" };
    }

    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function sizeOf(r) {
        var d = num(r["Stator Diameter (mm)"]);
        var h = num(r["Stator Height (mm)"]);
        if (d == null || h == null) return "";
        if (Number.isInteger(d) && Number.isInteger(h) && d < 100 && h < 100) return pad2(d) + pad2(h);
        return fmtNum(d) + "×" + fmtNum(h);
    }

    function nameFromLink(link) {
        try {
            var u = new URL(link);
            var segs = u.pathname.split("/").filter(Boolean);
            var s = decodeURIComponent(segs[segs.length - 1] || u.hostname);
            s = s
                .replace(/\.html?$/i, "")
                .replace(/^goods-\d+-/i, "")
                .replace(/-pro\d+$/i, "")
                .replace(/[-_+]+/g, " ")
                .trim();
            return s || u.hostname;
        } catch (e) {
            return link || "Unnamed motor";
        }
    }

    // Outgoing product links carry utm_source so shops can see the visit came from this database.
    // Only the href is tagged; the stored Link, CSV/JSON exports and the tooltip stay clean.
    function outLink(link) {
        // Appended as text so the shop's own query string is left exactly as it was.
        if (!/^https?:\/\//i.test(link) || /[?&]utm_source=/.test(link)) return link;
        var hash = link.indexOf("#");
        var base = hash === -1 ? link : link.slice(0, hash);
        var frag = hash === -1 ? "" : link.slice(hash);
        var sep = base.indexOf("?") === -1 ? "?" : /[?&]$/.test(base) ? "" : "&";
        return base + sep + "utm_source=marc-frank.github.io/motor-database&utm_medium=referral" + frag;
    }

    function hostOf(link) {
        try {
            return new URL(link).hostname.replace(/^www\./, "");
        } catch (e) {
            return "";
        }
    }

    // ---------- state ----------

    var rows = [];
    var specKeys = [];
    var columns = [];
    var filtered = [];
    var sort = { id: null, dir: 1 };
    var state = { q: "", f: {} }; // f: column id -> filter text

    // ---------- columns ----------

    function rawColumn(key) {
        var parts = splitLabel(key);
        var values = rows.map(function (r) { return r[key]; }).filter(filled);
        var numeric = values.length > 0 && values.filter(isPureNumber).length / values.length >= 0.8;
        return {
            id: key,
            label: parts.label,
            unit: parts.unit,
            num: numeric,
            value: function (r) {
                return numeric ? num(r[key]) : filled(r[key]) ? String(r[key]).toLowerCase() : null;
            },
            text: function (r) {
                if (key === "Price ($)" && isPureNumber(r[key] || "")) return "$" + parseFloat(r[key]).toFixed(2);
                return numeric ? fmtNum(r[key]) : filled(r[key]) ? String(r[key]) : "";
            },
        };
    }

    function buildColumns() {
        var cols = [
            {
                id: "image",
                label: "Image",
                cls: "c-image",
                noFilter: true,
                html: function (r) {
                    return '<div class="thumb">' + (r.Image ? '<img loading="lazy" referrerpolicy="no-referrer" alt="" src="' + esc(r.Image) + '" />' : MOTOR_ICON) + "</div>";
                },
                text: function (r) { return r.Image || ""; },
            },
            {
                id: "name",
                label: "Motor",
                cls: "c-motor",
                value: function (r) { return r._name.toLowerCase(); },
                html: function (r) {
                    return '<span class="motor-name">' + esc(r._name) + "</span>" + (r._hasSpecs ? "" : ' <span class="badge">no specs yet</span>');
                },
                text: function (r) { return r._name; },
            },
            {
                id: "Manufacturer",
                label: "Manufacturer",
                value: function (r) { return String(r.Manufacturer || "").toLowerCase(); },
                text: function (r) { return r.Manufacturer || ""; },
            },
            {
                id: "size",
                label: "Size",
                num: true,
                value: function (r) {
                    var d = num(r["Stator Diameter (mm)"]);
                    return d == null ? null : d * 1000 + (num(r["Stator Height (mm)"]) || 0);
                },
                html: function (r) { return r._size ? '<span class="size">' + esc(r._size) + "</span>" : ""; },
                text: function (r) { return r._size; },
            },
        ];

        // Spec columns: a few headline ones first, then in details-panel group order, then anything else.
        var order = LEAD_KEYS.slice();
        GROUPS.forEach(function (g) { order = order.concat(g[1]); });
        var keys = order.filter(function (k) { return specKeys.indexOf(k) !== -1; });
        keys = keys.filter(function (k, i) { return keys.indexOf(k) === i; });
        specKeys.forEach(function (k) {
            if (keys.indexOf(k) === -1) keys.push(k);
        });
        keys.forEach(function (k) {
            cols.push(rawColumn(k));
        });

        cols.push({
            id: "link",
            label: "Link",
            cls: "c-link",
            html: function (r) {
                return r.Link ? '<a class="ext" href="' + esc(outLink(r.Link)) + '" target="_blank" rel="noopener" title="' + esc(r.Link) + '" data-stop>' + EXT_ICON + "</a>" : "";
            },
            text: function (r) { return r.Link || ""; },
        });

        return cols;
    }

    function col(id) {
        for (var i = 0; i < columns.length; i++) if (columns[i].id === id) return columns[i];
        return null;
    }

    // ---------- filtering & sorting ----------

    // One numeric condition: "1950" (equals), ">1900", "<=30", "=2207" or "1700-2000". Null if it isn't one.
    function numCondition(c, t, val) {
        var n = "(-?\\d+(?:[.,]\\d+)?)";
        var m;
        if (new RegExp("^" + n + "$").test(t)) {
            // A bare number means "equals", except for Size, where "22" should find 2205, 2207, …
            if (c.id === "size") return function (r) { return r._size.indexOf(t) !== -1; };
            t = "=" + t;
        }
        if ((m = t.match(new RegExp("^(<=|>=|<|>|=)" + n + "$")))) {
            var x = num(m[2]), op = m[1];
            return function (r) {
                var v = val(r);
                if (v == null) return false;
                return op === "<" ? v < x : op === ">" ? v > x : op === "<=" ? v <= x : op === ">=" ? v >= x : v === x;
            };
        }
        if ((m = t.match(new RegExp("^" + n + "-" + n + "$")))) {
            var lo = num(m[1]), hi = num(m[2]);
            return function (r) {
                var v = val(r);
                return v != null && v >= lo && v <= hi;
            };
        }
        return null;
    }

    // Per-column filter: numeric columns accept "1950" (equals), ">1900", "<=30", "1700-2000", or several
    // of these at once (">1900 <2500");
    // anything else (and every text column) is a case-insensitive match on all space-separated words.
    function makeMatcher(c, query) {
        var q = query.trim().toLowerCase();
        if (!q) return null;
        if (c.num) {
            // Size compares as its 4-digit code, e.g. "2207-2306".
            var val = c.id === "size"
                ? function (r) { return /^\d{4}$/.test(r._size) ? +r._size : null; }
                : function (r) { return num(r[c.id]); };
            // Several conditions can be combined and must all hold: ">1900 <2500", ">=20, <=30", ">1500 and <2000".
            var norm = q
                .replace(/(<=|>=|<|>|=)\s+/g, "$1")
                .replace(/(\d)\s*(?:–|\.\.|-)\s*(?=-?\d)/g, "$1-");
            var parts = norm.split(/\s*(?:[\s,;&]|\band\b)\s*/).filter(function (t) { return t && !/^(<=|>=|<|>|=)$/.test(t); });
            var conds = parts.map(function (t) { return numCondition(c, t, val); });
            if (conds.length && conds.every(Boolean)) {
                return function (r) {
                    for (var i = 0; i < conds.length; i++) if (!conds[i](r)) return false;
                    return true;
                };
            }
        }
        var words = q.split(/\s+/);
        return function (r) {
            var t = c.text(r).toLowerCase();
            for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) === -1) return false;
            return true;
        };
    }

    function applyFilters() {
        var tokens = state.q.toLowerCase().split(/\s+/).filter(Boolean);
        var matchers = columns
            .map(function (c) { return state.f[c.id] ? makeMatcher(c, state.f[c.id]) : null; })
            .filter(Boolean);

        filtered = rows.filter(function (r) {
            for (var i = 0; i < tokens.length; i++) if (r._hay.indexOf(tokens[i]) === -1) return false;
            for (var j = 0; j < matchers.length; j++) if (!matchers[j](r)) return false;
            return true;
        });

        var c = sort.id && col(sort.id);
        if (c && c.value) {
            filtered.sort(function (a, b) {
                var va = c.value(a), vb = c.value(b);
                if (va == null && vb == null) return a._i - b._i;
                if (va == null) return 1; // empties always last
                if (vb == null) return -1;
                if (va < vb) return -sort.dir;
                if (va > vb) return sort.dir;
                return a._i - b._i;
            });
        } else {
            // Default: motors with the most data first, then manufacturer / name / KV.
            filtered.sort(function (a, b) {
                return (b._hasSpecs - a._hasSpecs) || a._i - b._i;
            });
        }
    }

    // ---------- rendering ----------

    function renderHead() {
        $("headRow").innerHTML = columns
            .map(function (c) {
                var cls = (c.cls || "") + (c.num ? " num" : "");
                cls = cls.trim() ? ' class="' + cls.trim() + '"' : "";
                if (c.id === "image") return "<th" + cls + '><span class="sr-only">Image</span></th>';
                var ind = sort.id === c.id ? (sort.dir > 0 ? "▲" : "▼") : "";
                var aria = sort.id === c.id ? (sort.dir > 0 ? "ascending" : "descending") : "none";
                return (
                    "<th" + cls + ' aria-sort="' + aria + '"><button type="button" data-sort="' + esc(c.id) + '">' +
                    esc(c.label) + (c.unit ? ' <span class="unit">' + esc(c.unit) + "</span>" : "") +
                    '<span class="sort-ind">' + ind + "</span></button></th>"
                );
            })
            .join("");
    }

    function renderFilterRow() {
        $("filterRow").innerHTML = columns
            .map(function (c) {
                var cls = c.cls ? ' class="' + c.cls + '"' : "";
                if (c.noFilter) return "<th" + cls + "></th>";
                var tip = c.num ? "A value (1950), a range (1700-2000) or conditions: >1900, <=30, >1900 <2500" : "Matches every word typed";
                return (
                    "<th" + cls + '><input type="search"' + (state.f[c.id] ? ' class="active"' : "") + ' data-filter="' + esc(c.id) + '" value="' + esc(state.f[c.id] || "") +
                    '" placeholder="filter" title="' + tip + '" aria-label="Filter ' + esc(c.label) + '" autocomplete="off" /></th>'
                );
            })
            .join("");
    }

    function cellHtml(c, r) {
        if (c.html) return c.html(r);
        return esc(c.text(r));
    }

    // ---------- virtual scrolling ----------
    // All filtered rows are scrollable, but only the ones near the viewport are in the DOM:
    // laying out ~2,500 rows x ~40 columns on every keystroke is far too slow.
    // Rows have a fixed height and columns fixed widths (measured once from all data) so nothing jumps.

    var ROW_H = 43;
    var OVERSCAN = 20;
    var win = { start: -1, end: -1 };

    function rowHtml(r) {
        var tds = columns
            .map(function (c) {
                var cls = [];
                if (c.cls) cls.push(c.cls);
                if (c.num) cls.push("num");
                var title = c.id === "name" ? ' title="' + esc(r._name) + '"' : "";
                return "<td" + (cls.length ? ' class="' + cls.join(" ") + '"' : "") + title + ">" + cellHtml(c, r) + "</td>";
            })
            .join("");
        return '<tr tabindex="0" data-i="' + r._i + '"' + (r._hasSpecs ? "" : ' class="stub"') + ">" + tds + "</tr>";
    }

    function spacer(h) {
        return h > 0 ? '<tr class="spacer" aria-hidden="true"><td colspan="' + columns.length + '" style="height:' + h + 'px"></td></tr>' : "";
    }

    function renderWindow(force) {
        var wrap = $("tableWrap");
        var view = Math.ceil(wrap.clientHeight / ROW_H);
        var first = Math.floor(wrap.scrollTop / ROW_H);
        var start = Math.max(0, first - OVERSCAN);
        var end = Math.min(filtered.length, first + view + OVERSCAN);
        if (!force && start === win.start && end === win.end) return;
        win = { start: start, end: end };
        $("body").innerHTML =
            spacer(start * ROW_H) +
            filtered.slice(start, end).map(rowHtml).join("") +
            spacer((filtered.length - end) * ROW_H);
    }

    function renderBody() {
        $("tableWrap").scrollTop = 0;
        renderWindow(true);
        $("empty").hidden = filtered.length > 0;
        if (!filtered.length) $("emptyText").textContent = "No motors match these filters.";
        renderStats();
    }

    // Column widths from the widest value in each column (header and filter box included).
    function sizeColumns() {
        var ctx = document.createElement("canvas").getContext("2d");
        var family = getComputedStyle(document.body).fontFamily;
        var mono = getComputedStyle(document.documentElement).getPropertyValue("--mono") || "monospace";
        function w(text, font) {
            ctx.font = font;
            return ctx.measureText(text).width;
        }
        var total = 0;
        var html = columns
            .map(function (c) {
                var px;
                if (c.id === "image") px = 56;
                else if (c.id === "link") px = 52;
                else {
                    var font = c.id === "name" ? "600 14px " + family : c.id === "size" ? "600 13px " + mono : "14px " + family;
                    var texts = rows.map(function (r) { return c.text(r); });
                    texts.sort(function (a, b) { return b.length - a.length; });
                    var widest = 0;
                    texts.slice(0, 12).forEach(function (t) { widest = Math.max(widest, w(t, font)); });
                    var head = w(c.label, "600 12px " + family) + (c.unit ? w(" " + c.unit, "12px " + family) : 0) + 14;
                    px = Math.ceil(Math.max(widest, head, 56) + 26);
                    if (c.id === "name") px = Math.min(px, 260);
                }
                total += px;
                return '<col style="width:' + px + 'px" />';
            })
            .join("");
        $("cols").innerHTML = html;
        $("grid").style.width = total + "px";
    }

    // One motor file = one model (with all its KV versions).
    function modelKey(r) {
        return r._file || r.Manufacturer + "|" + r._name;
    }

    function countOf(list, key) {
        return new Set(list.map(key)).size;
    }

    var totals = null;

    function renderStats() {
        if (!totals) {
            totals = { models: countOf(rows, modelKey), mfrs: countOf(rows, function (r) { return r.Manufacturer; }) };
        }
        function part(shown, total, noun) {
            return (shown === total ? "<b>" + total.toLocaleString() + "</b>" : "<b>" + shown.toLocaleString() + "</b> of <b>" + total.toLocaleString() + "</b>") + " " + noun;
        }
        $("stats").innerHTML = [
            part(filtered.length, rows.length, "entries"),
            part(countOf(filtered, modelKey), totals.models, "models"),
            part(countOf(filtered, function (r) { return r.Manufacturer; }), totals.mfrs, "manufacturers"),
        ].join(" · ");
        $("stats").title = "An entry is one KV version of a motor; a model is the motor with all its KV versions.";
    }

    function render() {
        applyFilters();
        renderHead();
        renderBody();
        $("reset").disabled = !state.q && !sort.id && !Object.keys(state.f).length;
        writeUrl();
    }

    // ---------- details drawer ----------

    var lastFocus = null;

    function openDrawer(r) {
        lastFocus = document.activeElement;
        $("dMfr").textContent = r.Manufacturer;
        $("dTitle").textContent = r._name;

        var siblings = rows.filter(function (o) {
            return o.Manufacturer === r.Manufacturer && o._name === r._name && o.Link === r.Link;
        });

        var specFilled = specKeys.filter(function (k) { return filled(r[k]); }).length;
        var pct = Math.round((specFilled / specKeys.length) * 100);

        var h = '<div class="hero"><div class="thumb">' +
            (r.Image ? '<img referrerpolicy="no-referrer" alt="" src="' + esc(r.Image) + '" />' : MOTOR_ICON) +
            '</div><div class="hero-facts">' +
            fact("Size", r._size) +
            fact("KV", fmtNum(r["KV (RPM/V)"])) +
            fact("Weight", r._weight != null ? fmtNum(String(r._weight)) + " g" : "") +
            fact("Price", col("Price ($)").text(r)) +
            "</div></div>";

        if (siblings.length > 1) {
            h += '<div class="kv-chips" aria-label="KV options">' +
                siblings
                    .map(function (s) {
                        var on = s === r;
                        return '<button type="button" data-open="' + s._i + '"' + (on ? ' aria-current="true"' : "") + '><span class="badge' + (on ? " badge-accent" : "") + '">' + esc(fmtNum(s["KV (RPM/V)"]) || "?") + " KV</span></button>";
                    })
                    .join("") +
                "</div>";
        }

        h += '<div class="drawer-actions">';
        if (r.Link) h += '<a class="btn btn-primary" href="' + esc(outLink(r.Link)) + '" target="_blank" rel="noopener">' + EXT_ICON + "<span>" + esc(hostOf(r.Link) || "Product page") + "</span></a>";
        if (r._file) h += '<a class="btn btn-ghost" href="' + REPO + "/edit/main/" + r._file.split("/").map(encodeURIComponent).join("/") + '" target="_blank" rel="noopener" title="Edit this motor\'s file on GitHub">Edit on GitHub</a>';
        h += "</div>";

        if (pct < 60) {
            h += '<div class="completeness"><b>' + pct + "% of fields filled in.</b>" +
                '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
                'Know this motor? <a href="' + REPO + '/blob/main/.github/CONTRIBUTING.md" target="_blank" rel="noopener">Help complete it</a>.</div>';
        }

        var used = new Set(IDENTITY);
        GROUPS.forEach(function (g) {
            g[1].forEach(function (k) { used.add(k); });
            h += group(g[0], g[1], r);
        });
        var others = specKeys.filter(function (k) { return !used.has(k); });
        if (others.length) h += group("Other", others, r);

        $("dBody").innerHTML = h;
        $("dBody").scrollTop = 0;
        $("drawer").classList.add("open");
        $("drawer").setAttribute("aria-hidden", "false");
        $("scrim").hidden = false;
        document.body.style.overflow = "hidden";
        $("dClose").focus();
    }

    function fact(label, value) {
        return '<div class="fact"><span>' + esc(label) + "</span><b>" + (filled(value) ? esc(value) : "—") + "</b></div>";
    }

    function group(title, keys, r) {
        var present = keys.filter(function (k) { return k in r || specKeys.indexOf(k) !== -1; });
        if (!present.length) return "";
        return '<section class="spec-group"><h3>' + esc(title) + "</h3><dl>" +
            present
                .map(function (k) {
                    var c = col(k);
                    var p = splitLabel(k);
                    var v = c ? c.text(r) : r[k];
                    var unit = filled(v) && p.unit && k !== "Price ($)" && isPureNumber(r[k] || "") ? " " + p.unit : "";
                    return "<dt>" + esc(p.label) + "</dt>" + (filled(v) ? "<dd>" + esc(v + unit) + "</dd>" : '<dd class="missing">—</dd>');
                })
                .join("") +
            "</dl></section>";
    }

    function closeDrawer() {
        $("drawer").classList.remove("open");
        $("drawer").setAttribute("aria-hidden", "true");
        $("scrim").hidden = true;
        document.body.style.overflow = "";
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    // ---------- URL state ----------

    // Filters live in the URL so any view can be linked to, e.g.
    //   ?search=2306  ?manufacturer=iFlight  ?kv=1700-2000  ?stator_diameter=23&stator_height=6  ?sort=-price
    // Each column's parameter is its label in snake_case (see paramKey). Older forms (?q=, ?f.<column>=,
    // ?mfr=, ?kvMin=…) are still read.
    var PARAM_ALIASES = { motor: "name", stator: "size", mfr: "Manufacturer" };

    function paramKey(c) {
        if (c.id === "name") return "name";
        return c.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    }

    function colByParam(k) {
        if (PARAM_ALIASES[k]) return col(PARAM_ALIASES[k]);
        if (k.indexOf("f.") === 0) return col(k.slice(2));
        for (var i = 0; i < columns.length; i++) if (paramKey(columns[i]) === k) return columns[i];
        return null;
    }

    function readUrl() {
        var p = new URLSearchParams(location.search);
        state.q = p.get("search") || p.get("q") || "";
        p.forEach(function (v, k) {
            var c = colByParam(k);
            if (c && !c.noFilter && v) state.f[c.id] = v;
        });
        [["kv", "KV (RPM/V)"], ["sd", "Stator Diameter (mm)"]].forEach(function (o) {
            var lo = p.get(o[0] + "Min"), hi = p.get(o[0] + "Max");
            if (lo && hi) state.f[o[1]] = lo + "-" + hi;
            else if (lo) state.f[o[1]] = ">=" + lo;
            else if (hi) state.f[o[1]] = "<=" + hi;
        });
        if (p.has("sort")) {
            var s = p.get("sort");
            var c = colByParam(s.replace(/^-/, "")) || col(s.replace(/^-/, ""));
            sort = c ? { id: c.id, dir: s.charAt(0) === "-" ? -1 : 1 } : { id: null, dir: 1 };
        }
    }

    function writeUrl() {
        var p = new URLSearchParams();
        if (state.q) p.set("search", state.q);
        columns.forEach(function (c) {
            if (state.f[c.id]) p.set(paramKey(c), state.f[c.id]);
        });
        if (sort.id) p.set("sort", (sort.dir < 0 ? "-" : "") + paramKey(col(sort.id)));
        var qs = p.toString();
        history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
    }

    // ---------- CSV ----------

    function download(text, type, name) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([text], { type: type }));
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    }

    // The filtered rows exactly as in database.json (one object per KV version).
    function exportJson() {
        var out = filtered.map(function (r) {
            var o = {};
            Object.keys(r).forEach(function (k) {
                if (k.charAt(0) !== "_") o[k] = r[k];
            });
            return o;
        });
        download(JSON.stringify(out, null, 2) + "\n", "application/json", "motors.json");
    }

    function exportCsv() {
        var cols = columns.filter(function (c) { return c.id !== "image"; });
        var lines = [cols.map(function (c) { return c.label + (c.unit ? " (" + c.unit + ")" : ""); })];
        filtered.forEach(function (r) {
            lines.push(cols.map(function (c) { return c.text(r); }));
        });
        var csv = lines
            .map(function (l) {
                return l.map(function (v) { return /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v; }).join(",");
            })
            .join("\n");
        download(csv, "text/csv", "motors.csv");
    }

    // ---------- events ----------

    function debounce(fn, ms) {
        var t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

    function bind() {
        var rerender = debounce(function () {
            applyFilters();
            renderBody();
            $("reset").disabled = !state.q && !sort.id && !Object.keys(state.f).length;
            writeUrl();
        }, 150);
        var ticking = false;
        $("tableWrap").addEventListener("scroll", function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                ticking = false;
                renderWindow(false);
            });
        });
        window.addEventListener("resize", function () { renderWindow(false); });
        $("q").addEventListener("input", function (e) {
            state.q = e.target.value.trim();
            rerender();
        });
        $("filterRow").addEventListener("input", function (e) {
            var id = e.target.getAttribute("data-filter");
            if (!id) return;
            var v = e.target.value.trim();
            if (v) state.f[id] = v;
            else delete state.f[id];
            e.target.classList.toggle("active", !!v);
            rerender();
        });

        function reset() {
            state = { q: "", f: {} };
            sort = { id: null, dir: 1 };
            $("q").value = "";
            renderFilterRow();
            render();
        }
        $("reset").addEventListener("click", reset);
        document.querySelector("[data-reset]").addEventListener("click", reset);

        $("headRow").addEventListener("click", function (e) {
            var b = e.target.closest("[data-sort]");
            if (!b) return;
            var id = b.getAttribute("data-sort");
            if (sort.id !== id) sort = { id: id, dir: col(id).num ? -1 : 1 };
            else if ((sort.dir === -1) === !!col(id).num) sort.dir = -sort.dir;
            else sort = { id: null, dir: 1 };
            render();
        });

        $("body").addEventListener("click", function (e) {
            if (e.target.closest("[data-stop]")) return;
            var tr = e.target.closest("tr[data-i]");
            if (tr) openDrawer(rows[+tr.getAttribute("data-i")]);
        });
        $("body").addEventListener("keydown", function (e) {
            if (e.key !== "Enter" && e.key !== " ") return;
            var tr = e.target.closest("tr[data-i]");
            if (tr && e.target === tr) {
                e.preventDefault();
                openDrawer(rows[+tr.getAttribute("data-i")]);
            }
        });
        // Broken product images fall back to the motor icon.
        document.addEventListener(
            "error",
            function (e) {
                if (e.target.tagName === "IMG" && e.target.parentNode.classList.contains("thumb")) {
                    e.target.parentNode.innerHTML = MOTOR_ICON;
                }
            },
            true
        );

        $("dBody").addEventListener("click", function (e) {
            var b = e.target.closest("[data-open]");
            if (b) openDrawer(rows[+b.getAttribute("data-open")]);
        });
        $("dClose").addEventListener("click", closeDrawer);
        $("scrim").addEventListener("click", closeDrawer);
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                if ($("drawer").classList.contains("open")) closeDrawer();
            }
        });

        $("csv").addEventListener("click", exportCsv);
        $("json").addEventListener("click", exportJson);

        $("themeToggle").addEventListener("click", function () {
            var cur = document.documentElement.getAttribute("data-theme");
            if (!cur) cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            var next = cur === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", next);
            try {
                localStorage.setItem("theme", next);
            } catch (e) {}
        });
    }

    // ---------- boot ----------

    function prepare(data) {
        var keys = [];
        var seen = new Set();
        data.forEach(function (r) {
            Object.keys(r).forEach(function (k) {
                if (!seen.has(k)) {
                    seen.add(k);
                    keys.push(k);
                }
            });
        });
        // "_file" (the motor's source file) and other "_" fields are metadata, not specs.
        specKeys = keys.filter(function (k) { return IDENTITY.indexOf(k) === -1 && k.charAt(0) !== "_"; });

        rows = data.map(function (r, i) {
            r._i = i;
            r._name = filled(r.Name) ? String(r.Name) : nameFromLink(r.Link);
            r._size = sizeOf(r);
            var w = num(r["Weight (incl. Cable) (g)"]);
            r._weight = w != null ? w : num(r["Weight (excl. Cable) (g)"]);
            var n = specKeys.filter(function (k) { return filled(r[k]); }).length;
            r._hasSpecs = filled(r.Name) || n >= 3 ? 1 : 0;
            // Global search looks at every field (except image/link URLs), plus "1950kv"-style KV.
            var hay = [r._name, r._size, filled(r["KV (RPM/V)"]) ? r["KV (RPM/V)"] + "kv" : ""];
            Object.keys(data[i]).forEach(function (k) {
                if (k.charAt(0) !== "_" && k !== "Image" && k !== "Link" && filled(r[k])) hay.push(r[k]);
            });
            if (filled(r["Price ($)"]) && isPureNumber(r["Price ($)"])) hay.push("$" + parseFloat(r["Price ($)"]).toFixed(2));
            r._hay = hay.filter(filled).join(" | ").toLowerCase();
            return r;
        });
    }

    function boot(data) {
        prepare(data);
        columns = buildColumns();
        readUrl();

        var stubs = rows.filter(function (r) { return !r._hasSpecs; }).length;
        if (stubs) {
            $("stubNote").innerHTML =
                "<b>" + stubs.toLocaleString() + "</b> listed motors have no specs yet (sorted last) — " +
                '<a href="' + REPO + '/blob/main/.github/CONTRIBUTING.md" target="_blank" rel="noopener">help fill them in</a>.';
        }

        $("q").value = state.q;
        $("tableWrap").hidden = false;
        sizeColumns();
        renderFilterRow();
        bind();
        $("loading").hidden = true;
        render();
        var first = $("body").querySelector("tr[data-i]");
        if (first && first.offsetHeight) ROW_H = first.offsetHeight;
    }

    fetch("database.json")
        .then(function (res) {
            if (!res.ok) throw new Error(res.status + " " + res.statusText);
            return res.json();
        })
        .then(boot)
        .catch(function (err) {
            $("loadingText").textContent = "Couldn't load the interactive table (" + err.message + ").";
        });
})();
