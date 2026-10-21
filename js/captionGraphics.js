/**
 * CS Trim - Caption Graphics
 * Builds one native Premiere text Graphic (.mogrt) per caption line from Premiere's own "Basic Title" template,
 * so captions land on the timeline as editable Essential Graphics text that the plugin can later replace.
 */
var CaptionGraphics = {
    CLIP_PREFIX: "cstrim_cap_",
    _template: null,
    _crcTable: null,

    getNodeRequire: function () {
        if (typeof window !== "undefined" && window.cep_node && window.cep_node.require) return window.cep_node.require;
        if (typeof require !== "undefined") return require;
        return null;
    },

    /**
     * Locate Premiere's bundled "Basic Title.mogrt" next to the running host application
     */
    findTemplatePath: function () {
        var nodeReq = this.getNodeRequire();
        if (!nodeReq) return "";
        var fs = nodeReq("fs");
        var path = nodeReq("path");
        var hostPath = "";
        try {
            if (typeof csInterface !== "undefined" && csInterface && csInterface.getSystemPath) {
                hostPath = csInterface.getSystemPath("hostApplication") || "";
            }
        } catch (e) {}
        if (!hostPath) return "";

        // macOS: <App>.app/Contents/MacOS/<exe> -> <App>.app/Contents/Essential Graphics
        // Windows: <Install>\Adobe Premiere Pro.exe -> <Install>\Essential Graphics
        var dir = path.dirname(hostPath);
        for (var up = 0; up < 4; up++) {
            var candidates = [
                path.join(dir, "Essential Graphics", "Basic Title.mogrt"),
                path.join(dir, "Contents", "Essential Graphics", "Basic Title.mogrt")
            ];
            for (var c = 0; c < candidates.length; c++) {
                try { if (fs.existsSync(candidates[c])) return candidates[c]; } catch (e2) {}
            }
            dir = path.dirname(dir);
        }
        return "";
    },

    crc32: function (buf) {
        if (!this._crcTable) {
            var table = new Array(256);
            for (var n = 0; n < 256; n++) {
                var c = n;
                for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                table[n] = c >>> 0;
            }
            this._crcTable = table;
        }
        var crc = 0xFFFFFFFF;
        for (var i = 0; i < buf.length; i++) crc = this._crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    },

    /**
     * Minimal ZIP reader (stored + deflate entries) -> { name: Buffer }, in archive order
     */
    readZip: function (buf) {
        var zlib = this.getNodeRequire()("zlib");
        var eocd = -1;
        for (var i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
            if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error("Invalid zip archive");
        var count = buf.readUInt16LE(eocd + 10);
        var ptr = buf.readUInt32LE(eocd + 16);
        var entries = { _order: [] };
        for (var e = 0; e < count; e++) {
            var method = buf.readUInt16LE(ptr + 10);
            var compSize = buf.readUInt32LE(ptr + 20);
            var nameLen = buf.readUInt16LE(ptr + 28);
            var extraLen = buf.readUInt16LE(ptr + 30);
            var commentLen = buf.readUInt16LE(ptr + 32);
            var localOff = buf.readUInt32LE(ptr + 42);
            var name = buf.slice(ptr + 46, ptr + 46 + nameLen).toString("utf8");
            var lNameLen = buf.readUInt16LE(localOff + 26);
            var lExtraLen = buf.readUInt16LE(localOff + 28);
            var dataStart = localOff + 30 + lNameLen + lExtraLen;
            var data = buf.slice(dataStart, dataStart + compSize);
            entries[name] = (method === 8) ? zlib.inflateRawSync(data) : Buffer.from(data);
            entries._order.push(name);
            ptr += 46 + nameLen + extraLen + commentLen;
        }
        return entries;
    },

    /**
     * Minimal ZIP writer (deflate) from [{ name, data: Buffer }]
     */
    writeZip: function (files) {
        var zlib = this.getNodeRequire()("zlib");
        var locals = [];
        var centrals = [];
        var offset = 0;
        for (var i = 0; i < files.length; i++) {
            var nameBuf = Buffer.from(files[i].name, "utf8");
            var raw = files[i].data;
            var comp = zlib.deflateRawSync(raw);
            var crc = this.crc32(raw);

            var lh = Buffer.alloc(30);
            lh.writeUInt32LE(0x04034b50, 0);
            lh.writeUInt16LE(20, 4);
            lh.writeUInt16LE(0x0800, 6);
            lh.writeUInt16LE(8, 8);
            lh.writeUInt32LE(crc, 14);
            lh.writeUInt32LE(comp.length, 18);
            lh.writeUInt32LE(raw.length, 22);
            lh.writeUInt16LE(nameBuf.length, 26);
            locals.push(lh, nameBuf, comp);

            var ch = Buffer.alloc(46);
            ch.writeUInt32LE(0x02014b50, 0);
            ch.writeUInt16LE(20, 4);
            ch.writeUInt16LE(20, 6);
            ch.writeUInt16LE(0x0800, 8);
            ch.writeUInt16LE(8, 10);
            ch.writeUInt32LE(crc, 16);
            ch.writeUInt32LE(comp.length, 20);
            ch.writeUInt32LE(raw.length, 24);
            ch.writeUInt16LE(nameBuf.length, 28);
            ch.writeUInt32LE(offset, 42);
            centrals.push(ch, nameBuf);

            offset += 30 + nameBuf.length + comp.length;
        }
        var centralBuf = Buffer.concat(centrals);
        var end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50, 0);
        end.writeUInt16LE(files.length, 8);
        end.writeUInt16LE(files.length, 10);
        end.writeUInt32LE(centralBuf.length, 12);
        end.writeUInt32LE(offset, 16);
        return Buffer.concat(locals.concat([centralBuf, end]));
    },

    /**
     * Parse the Basic Title template once: its definition, inner project and the Source Text blob
     */
    loadTemplate: function (templatePath) {
        if (this._template && this._template.path === templatePath) return this._template;
        var nodeReq = this.getNodeRequire();
        var fs = nodeReq("fs");
        var zlib = nodeReq("zlib");

        var outer = this.readZip(fs.readFileSync(templatePath));
        if (!outer["project.prgraphic"] || !outer["definition.json"]) throw new Error("Unexpected Basic Title template layout");
        var inner = this.readZip(outer["project.prgraphic"]);
        var projName = null;
        for (var i = 0; i < inner._order.length; i++) {
            if (/\.prproj$/i.test(inner._order[i])) projName = inner._order[i];
        }
        if (!projName) throw new Error("Template project not found");
        var xml = zlib.gunzipSync(inner[projName]).toString("utf8");

        // The Source Text keyframe: 8-byte little-endian length + UTF-16LE JSON. BinaryHash ends with (blob length + 12) in hex.
        var re = /BinaryHash="([0-9a-fA-F-]+?)([0-9a-fA-F]{8})">\s*([A-Za-z0-9+\/=]+)(\s*)</g;
        var m, found = null;
        while ((m = re.exec(xml)) !== null) {
            var blob = Buffer.from(m[3], "base64");
            if (blob.length < 16) continue;
            var json = blob.slice(8).toString("utf16le");
            if (json.indexOf("\"mTextParam\"") === -1) continue;
            found = { start: m.index, end: m.index + m[0].length, hashPrefix: m[1], trailing: m[4], doc: JSON.parse(json) };
            break;
        }
        if (!found) throw new Error("Source Text not found in template");

        this._template = {
            path: templatePath,
            outer: outer,
            inner: inner,
            projName: projName,
            xml: xml,
            text: found,
            definition: JSON.parse(outer["definition.json"].toString("utf8"))
        };
        return this._template;
    },

    /**
     * Write a .mogrt whose text layer holds `text` with the given style
     */
    buildMogrt: function (text, style, outPath) {
        var nodeReq = this.getNodeRequire();
        var fs = nodeReq("fs");
        var zlib = nodeReq("zlib");
        var tpl = this._template;

        var doc = JSON.parse(JSON.stringify(tpl.text.doc));
        var tp = doc.mTextParam;
        var ss = tp.mStyleSheet;
        tp.mRTL = Boolean(style.rtl);
        tp.mAlignment = 2;
        ss.mText = text;
        ss.mFontName = { mParamValues: [[0, style.fontName]] };
        ss.mFontSize = { mParamValues: [[0, style.fontSize]] };
        ss.mFillColor = { mParamValues: [[0, style.fillColor]] };
        ss.mFillVisible = { mParamValues: [[0, true]] };
        ss.mStrokeVisible = { mParamValues: [[0, style.strokeWidth > 0]] };
        ss.mStrokeColor = { mParamValues: [[0, style.strokeColor]] };
        ss.mStrokeWidth = { mParamValues: [[0, style.strokeWidth]] };
        ss.mFillOverStroke = { mParamValues: [[0, true]] };

        var jsonBuf = Buffer.from(JSON.stringify(doc), "utf16le");
        var lenBuf = Buffer.alloc(8);
        lenBuf.writeUInt32LE(jsonBuf.length, 0);
        var blob = Buffer.concat([lenBuf, jsonBuf]);
        var hash = tpl.text.hashPrefix + ("00000000" + (blob.length + 12).toString(16)).slice(-8);
        var xml = tpl.xml.slice(0, tpl.text.start) +
            "BinaryHash=\"" + hash + "\">" + blob.toString("base64") + tpl.text.trailing + "<" +
            tpl.xml.slice(tpl.text.end);

        var innerFiles = [];
        for (var i = 0; i < tpl.inner._order.length; i++) {
            var n = tpl.inner._order[i];
            innerFiles.push({ name: n, data: (n === tpl.projName) ? zlib.gzipSync(Buffer.from(xml, "utf8")) : tpl.inner[n] });
        }

        var def = JSON.parse(JSON.stringify(tpl.definition));
        def.capsuleName = "CS Trim Caption";
        var controls = def.clientControls || [];
        for (var c = 0; c < controls.length; c++) {
            if (controls[c].type === 6) controls[c].value = { strDB: [{ localeString: "en_US", str: text }] };
        }

        // Localized project/thumb variants would override the edited project in non-English Premiere UIs
        var outerFiles = [];
        for (var o = 0; o < tpl.outer._order.length; o++) {
            var on = tpl.outer._order[o];
            if (/^project_.+\.prgraphic$/i.test(on) || /^thumb_/i.test(on)) continue;
            var data = tpl.outer[on];
            if (on === "project.prgraphic") data = this.writeZip(innerFiles);
            else if (on === "definition.json") data = Buffer.from(JSON.stringify(def), "utf8");
            outerFiles.push({ name: on, data: data });
        }
        fs.writeFileSync(outPath, this.writeZip(outerFiles));
    },

    /**
     * Break a caption into lines that fit the frame width (measured with the same font on a canvas)
     */
    wrapText: function (text, fontSize, maxWidth) {
        var words = String(text || "").split(/\s+/).filter(Boolean);
        if (typeof document === "undefined") return words.join(" ");
        var ctx = document.createElement("canvas").getContext("2d");
        ctx.font = "bold " + fontSize + "px Arial, sans-serif";
        var lines = [];
        var cur = "";
        for (var i = 0; i < words.length; i++) {
            var next = cur ? (cur + " " + words[i]) : words[i];
            if (cur && ctx.measureText(next).width > maxWidth) {
                lines.push(cur);
                cur = words[i];
            } else {
                cur = next;
            }
        }
        if (cur) lines.push(cur);
        return lines.join("\r");
    },

    /**
     * Build one .mogrt per cue and a manifest for importCaptionGraphics() in the host
     */
    buildForCues: function (cues, options, onProgress) {
        var self = this;
        options = options || {};
        return new Promise(function (resolve, reject) {
            try {
                var nodeReq = self.getNodeRequire();
                if (!nodeReq) return reject(new Error("Node.js runtime not available"));
                var fs = nodeReq("fs");
                var os = nodeReq("os");
                var path = nodeReq("path");

                var templatePath = self.findTemplatePath();
                if (!templatePath) return reject(new Error("Basic Title template not found"));

                var tpl = self.loadTemplate(templatePath);
                var seqWidth = parseInt(options.seqWidth, 10) || 1080;
                var seqHeight = parseInt(options.seqHeight, 10) || 1920;

                // Premiere fits the template's frame (1920x1080) into the sequence, so text sizes are in template pixels
                var tplSize = { x: 1920, y: 1080 };
                try {
                    var si = tpl.definition.sourceInfoLocalized.en_US.framesize.size;
                    if (si && si.x && si.y) tplSize = si;
                } catch (e) {}
                var fitScale = Math.min(seqWidth / tplSize.x, seqHeight / tplSize.y) || 1;
                var screenFontPx = Math.round(Math.min(seqWidth, seqHeight) * 0.075);
                var fontSize = Math.round(screenFontPx / fitScale);
                var style = {
                    fontName: "Arial-BoldMT",
                    fontSize: fontSize,
                    fillColor: 0xFFFFFF,
                    strokeColor: 0x000000,
                    strokeWidth: Math.max(3, Math.round(fontSize * 0.09)),
                    rtl: true
                };

                var runTag = String(Date.now());
                var outDir = path.join(os.tmpdir(), "cstrim_cap_" + runTag);
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

                var items = [];
                for (var i = 0; i < cues.length; i++) {
                    var cue = cues[i];
                    var text = self.wrapText(cue.text, screenFontPx, seqWidth * 0.78);
                    if (!text) continue;
                    var num = ("0000" + (items.length + 1)).slice(-4);
                    var mogrtPath = path.join(outDir, "cap_" + num + ".mogrt");
                    self.buildMogrt(text, style, mogrtPath);
                    items.push({
                        clipName: self.CLIP_PREFIX + num,
                        mogrtPath: mogrtPath,
                        start: Number(Number(cue.start).toFixed(3)),
                        end: Number(Number(cue.end).toFixed(3))
                    });
                    if (onProgress && i % 5 === 0) {
                        onProgress(86 + Math.round(((i + 1) / cues.length) * 8), "מייצר שכבות טקסט (" + (i + 1) + "/" + cues.length + ")...");
                    }
                }

                var manifestPath = path.join(outDir, "manifest.json");
                fs.writeFileSync(manifestPath, JSON.stringify({ posY: 0.8, items: items }), "utf8");
                resolve({ manifestPath: manifestPath, count: items.length });
            } catch (e) {
                reject(e);
            }
        });
    }
};
