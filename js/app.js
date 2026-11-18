(function () {
    "use strict";

    var REPO = "https://github.com/marc-frank/motor-database";
    var PAGE = 150;
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

    var DEFAULT_COLS = ["image", "motor", "size", "KV (RPM/V)", "weight", "Price ($)", "Stator Configuration", "Internal Resistance (mΩ)", "Shaft Diameter (external) (mm)", "mount", "link"];

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
    var visible = [];
    var filtered = [];
    var shown = PAGE;
    var sort = { id: null, dir: 1 };
    var state = { q: "", mfr: "", sdMin: "", sdMax: "", kvMin: "", kvMax: "", specOnly: true };

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
            count: values.length,
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
                fixed: true,
                cls: "c-image",
                html: function (r) {
                    return '<div class="thumb">' + (r.Image ? '<img loading="lazy" referrerpolicy="no-referrer" alt="" src="' + esc(r.Image) + '" />' : MOTOR_ICON) + "</div>";
                },
                text: function (r) { return r.Image || ""; },
            },
            {
                id: "motor",
                label: "Motor",
                fixed: true,
                cls: "c-motor",
                value: function (r) { return (r.Manufacturer + " " + r._name).toLowerCase(); },
                html: function (r) {
                    return '<div class="motor-name">' + esc(r._name) + (r._hasSpecs ? "" : ' <span class="badge">no specs yet</span>') + '</div><div class="motor-mfr">' + esc(r.Manufacturer) + "</div>";
                },
                text: function (r) { return r.Manufacturer + " " + r._name; },
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
            {
                id: "weight",
                label: "Weight",
                unit: "g",
                num: true,
                value: function (r) { return r._weight; },
                text: function (r) { return r._weight == null ? "" : fmtNum(String(r._weight)); },
            },
            {
                id: "mount",
                label: "Mount",
                value: function (r) { return num(r["Mounting Pattern Diameter (mm)"]); },
                text: function (r) {
                    var d = r["Mounting Pattern Diameter (mm)"];
                    var t = r["Mounting Screw Thread"];
                    return [filled(d) ? fmtNum(d) + " mm" : "", filled(t) ? t : ""].filter(Boolean).join(" · ");
                },
            },
        ];

        specKeys.forEach(function (k) {
            cols.push(rawColumn(k));
        });

        cols.push({
            id: "link",
            label: "Link",
            fixed: true,
            cls: "c-link",
            html: function (r) {
                return r.Link ? '<a class="ext" href="' + esc(r.Link) + '" target="_blank" rel="noopener" title="Open product page" data-stop>' + EXT_ICON + "</a>" : "";
            },
            text: function (r) { return r.Link || ""; },
        });

        cols.forEach(function (c) {
            if (c.count == null) c.count = rows.filter(function (r) { return filled(c.text(r)); }).length;
        });
        return cols;
    }

    function col(id) {
        for (var i = 0; i < columns.length; i++) if (columns[i].id === id) return columns[i];
        return null;
    }

    // ---------- filtering & sorting ----------

    function applyFilters() {
        var tokens = state.q.toLowerCase().split(/\s+/).filter(Boolean);
        var sdMin = num(state.sdMin), sdMax = num(state.sdMax), kvMin = num(state.kvMin), kvMax = num(state.kvMax);

        filtered = rows.filter(function (r) {
            if (state.specOnly && !r._hasSpecs) return false;
            if (state.mfr && r.Manufacturer !== state.mfr) return false;
            var sd = num(r["Stator Diameter (mm)"]);
            if (sdMin != null && (sd == null || sd < sdMin)) return false;
            if (sdMax != null && (sd == null || sd > sdMax)) return false;
            var kv = num(r["KV (RPM/V)"]);
            if (kvMin != null && (kv == null || kv < kvMin)) return false;
            if (kvMax != null && (kv == null || kv > kvMax)) return false;
            for (var i = 0; i < tokens.length; i++) if (r._hay.indexOf(tokens[i]) === -1) return false;
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
        shown = PAGE;
    }

    // ---------- rendering ----------

    function renderHead() {
        $("headRow").innerHTML = visible
            .map(function (id) {
                var c = col(id);
                if (!c) return "";
                var cls = c.num ? ' class="num"' : "";
                if (id === "image" || id === "link") return "<th" + cls + '><span class="sr-only"></span></th>';
                var ind = sort.id === id ? (sort.dir > 0 ? "▲" : "▼") : "";
                var aria = sort.id === id ? (sort.dir > 0 ? "ascending" : "descending") : "none";
                return (
                    "<th" + cls + ' aria-sort="' + aria + '"><button type="button" data-sort="' + esc(id) + '">' +
                    esc(c.label) + (c.unit ? ' <span class="unit">' + esc(c.unit) + "</span>" : "") +
                    '<span class="sort-ind">' + ind + "</span></button></th>"
                );
            })
            .join("");
    }

    function cellHtml(c, r) {
        if (c.html) return c.html(r);
        return esc(c.text(r));
    }

    function summary(r) {
        var parts = [];
        if (r._size) parts.push(r._size);
        if (filled(r["KV (RPM/V)"])) parts.push(fmtNum(r["KV (RPM/V)"]) + " KV");
        if (r._weight != null) parts.push(fmtNum(String(r._weight)) + " g");
        if (filled(r["Price ($)"])) parts.push(col("Price ($)").text(r));
        return parts.join(" · ");
    }

    function renderBody() {
        var slice = filtered.slice(0, shown);
        var html = slice
            .map(function (r) {
                var tds = visible
                    .map(function (id) {
                        var c = col(id);
                        if (!c) return "";
                        var cls = [c.cls || "c-extra"];
                        if (c.num) cls.push("num");
                        var inner = cellHtml(c, r);
                        return '<td class="' + cls.join(" ") + '" data-label="' + esc(c.label) + '">' + inner + "</td>";
                    })
                    .join("");
                tds += '<td class="c-summary">' + esc(summary(r)) + "</td>";
                return '<tr tabindex="0" data-i="' + r._i + '"' + (r._hasSpecs ? "" : ' class="stub"') + ">" + tds + "</tr>";
            })
            .join("");
        $("body").innerHTML = html;

        $("empty").hidden = filtered.length > 0;
        $("tableWrap").hidden = filtered.length === 0;
        var rest = filtered.length - shown;
        $("more").hidden = rest <= 0;
        $("moreBtn").textContent = "Show " + Math.min(rest, PAGE) + " more (" + rest + " remaining)";
        renderStats();
    }

    function renderStats() {
        var models = new Set(rows.map(function (r) { return r.Manufacturer + "|" + r._name + "|" + r.Link; })).size;
        var mfrs = new Set(rows.map(function (r) { return r.Manufacturer; })).size;
        $("stats").innerHTML =
            "Showing <b>" + filtered.length.toLocaleString() + "</b> of <b>" + rows.length.toLocaleString() + "</b> entries · <b>" +
            models.toLocaleString() + "</b> models from <b>" + mfrs + "</b> manufacturers";
    }

    function render() {
        applyFilters();
        renderHead();
        renderBody();
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
        if (r.Link) h += '<a class="btn btn-primary" href="' + esc(r.Link) + '" target="_blank" rel="noopener">' + EXT_ICON + "<span>" + esc(hostOf(r.Link) || "Product page") + "</span></a>";
        h += '<a class="btn btn-ghost" href="' + REPO + "/tree/main/motors/" + encodeURIComponent(r.Manufacturer) + '" target="_blank" rel="noopener">Edit data</a></div>';

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

    // ---------- columns menu ----------

    function renderColsMenu() {
        $("colsPanel").innerHTML = columns
            .filter(function (c) { return !c.fixed; })
            .map(function (c) {
                return '<label><input type="checkbox" value="' + esc(c.id) + '"' + (visible.indexOf(c.id) !== -1 ? " checked" : "") + " /> " +
                    esc(c.label) + (c.unit ? ' <span class="unit">(' + esc(c.unit) + ")</span>" : "") +
                    '<span class="count" title="Entries with a value">' + c.count + "</span></label>";
            })
            .join("");
    }

    function setColsOpen(open) {
        $("colsPanel").hidden = !open;
        $("colsBtn").setAttribute("aria-expanded", String(open));
    }

    // ---------- URL state ----------

    function readUrl() {
        var p = new URLSearchParams(location.search);
        ["q", "mfr", "sdMin", "sdMax", "kvMin", "kvMax"].forEach(function (k) {
            if (p.has(k)) state[k] = p.get(k);
        });
        if (p.get("all") === "1") state.specOnly = false;
        if (p.has("sort")) {
            var s = p.get("sort");
            sort = { id: s.replace(/^-/, ""), dir: s.charAt(0) === "-" ? -1 : 1 };
        }
        if (p.has("cols")) visible = p.get("cols").split(",");
    }

    function writeUrl() {
        var p = new URLSearchParams();
        ["q", "mfr", "sdMin", "sdMax", "kvMin", "kvMax"].forEach(function (k) {
            if (state[k]) p.set(k, state[k]);
        });
        if (!state.specOnly) p.set("all", "1");
        if (sort.id) p.set("sort", (sort.dir < 0 ? "-" : "") + sort.id);
        if (visible.join(",") !== DEFAULT_COLS.join(",")) p.set("cols", visible.join(","));
        var qs = p.toString();
        history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
    }

    function syncInputs() {
        $("q").value = state.q;
        $("mfr").value = state.mfr;
        $("sdMin").value = state.sdMin;
        $("sdMax").value = state.sdMax;
        $("kvMin").value = state.kvMin;
        $("kvMax").value = state.kvMax;
        $("specOnly").checked = state.specOnly;
    }

    // ---------- CSV ----------

    function exportCsv() {
        var cols = visible.map(col).filter(function (c) { return c && c.id !== "image"; });
        var lines = [cols.map(function (c) { return c.label + (c.unit ? " (" + c.unit + ")" : ""); })];
        filtered.forEach(function (r) {
            lines.push(cols.map(function (c) { return c.text(r); }));
        });
        var csv = lines
            .map(function (l) {
                return l.map(function (v) { return /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v; }).join(",");
            })
            .join("\n");
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "motors.csv";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
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
        var rerender = debounce(render, 120);
        [["q", "q"], ["sdMin", "sdMin"], ["sdMax", "sdMax"], ["kvMin", "kvMin"], ["kvMax", "kvMax"]].forEach(function (p) {
            $(p[0]).addEventListener("input", function (e) {
                state[p[1]] = e.target.value.trim();
                rerender();
            });
        });
        $("mfr").addEventListener("change", function (e) {
            state.mfr = e.target.value;
            render();
        });
        $("specOnly").addEventListener("change", function (e) {
            state.specOnly = e.target.checked;
            render();
        });

        function reset() {
            state = { q: "", mfr: "", sdMin: "", sdMax: "", kvMin: "", kvMax: "", specOnly: true };
            sort = { id: null, dir: 1 };
            syncInputs();
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

        $("moreBtn").addEventListener("click", function () {
            shown += PAGE;
            renderBody();
        });

        $("dBody").addEventListener("click", function (e) {
            var b = e.target.closest("[data-open]");
            if (b) openDrawer(rows[+b.getAttribute("data-open")]);
        });
        $("dClose").addEventListener("click", closeDrawer);
        $("scrim").addEventListener("click", closeDrawer);
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                if ($("drawer").classList.contains("open")) closeDrawer();
                else setColsOpen(false);
            }
        });

        $("colsBtn").addEventListener("click", function (e) {
            e.stopPropagation();
            setColsOpen($("colsPanel").hidden);
        });
        $("colsPanel").addEventListener("click", function (e) {
            e.stopPropagation();
        });
        $("colsPanel").addEventListener("change", function (e) {
            var id = e.target.value;
            if (e.target.checked) {
                // Keep the chosen columns in the master order, link last.
                var set = new Set(visible.concat([id]));
                visible = columns.map(function (c) { return c.id; }).filter(function (c) { return set.has(c); });
            } else {
                visible = visible.filter(function (c) { return c !== id; });
                if (sort.id === id) sort = { id: null, dir: 1 };
            }
            render();
        });
        document.addEventListener("click", function () {
            setColsOpen(false);
        });

        $("csv").addEventListener("click", exportCsv);

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
        specKeys = keys.filter(function (k) { return IDENTITY.indexOf(k) === -1; });

        rows = data.map(function (r, i) {
            r._i = i;
            r._name = filled(r.Name) ? String(r.Name) : nameFromLink(r.Link);
            r._size = sizeOf(r);
            var w = num(r["Weight (incl. Cable) (g)"]);
            r._weight = w != null ? w : num(r["Weight (excl. Cable) (g)"]);
            var n = specKeys.filter(function (k) { return filled(r[k]); }).length;
            r._hasSpecs = filled(r.Name) || n >= 3 ? 1 : 0;
            r._hay = [r.Manufacturer, r._name, r._size, r["KV (RPM/V)"] ? r["KV (RPM/V)"] + "kv " + r["KV (RPM/V)"] : "", r["Stator Configuration"], r["Magnet Type"]]
                .filter(filled)
                .join(" ")
                .toLowerCase();
            return r;
        });
    }

    function boot(data) {
        prepare(data);
        columns = buildColumns();
        visible = DEFAULT_COLS.slice();
        readUrl();
        visible = visible.filter(function (id) { return col(id); });

        var mfrs = Array.from(new Set(rows.map(function (r) { return r.Manufacturer; }))).sort(function (a, b) {
            return a.localeCompare(b, undefined, { sensitivity: "base" });
        });
        $("mfr").innerHTML += mfrs
            .map(function (m) {
                var n = rows.filter(function (r) { return r.Manufacturer === m; }).length;
                return '<option value="' + esc(m) + '">' + esc(m) + " (" + n + ")</option>";
            })
            .join("");

        var stubs = rows.filter(function (r) { return !r._hasSpecs; }).length;
        if (stubs) {
            $("stubNote").innerHTML =
                "<b>" + stubs.toLocaleString() + "</b> listed motors have no specs yet. Turn off “Only with specs” to see them, and " +
                '<a href="' + REPO + '/blob/main/.github/CONTRIBUTING.md" target="_blank" rel="noopener">help fill them in</a>.';
        }

        syncInputs();
        renderColsMenu();
        bind();
        $("loading").hidden = true;
        render();
    }

    fetch("database.json")
        .then(function (res) {
            if (!res.ok) throw new Error(res.status + " " + res.statusText);
            return res.json();
        })
        .then(boot)
        .catch(function (err) {
            $("loading").textContent = "Couldn't load the motor list (" + err.message + ").";
        });
})();
