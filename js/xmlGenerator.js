/**
 * CS Trim XML Generator
 * Modifies Premiere Pro / Final Cut Pro XML to split clips according to speech segments.
 */

var XmlGenerator = {
    /**
     * Generate cut sequence XML based on speech segments
     * @param {string} sourceXmlContent - Original XML content from Premiere
     * @param {Array} speechSegments - Array of {start, end, duration} in seconds
     * @param {number} timebase - Frame rate timebase (e.g. 25, 30)
     * @returns {string} Modified XML string with silence cut out
     */
    generateCutXml: function (sourceXmlContent, speechSegments, timebase) {
        var fps = timebase || 25;
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(sourceXmlContent, "text/xml");

        // Update Sequence name
        var seqNameNode = xmlDoc.querySelector("sequence > name");
        if (seqNameNode) {
            seqNameNode.textContent = seqNameNode.textContent + "_CSTrim";
        }

        // Process video tracks and audio tracks
        var tracks = xmlDoc.querySelectorAll("media > video > track, media > audio > track");

        tracks.forEach(function (track) {
            var clipItems = Array.from(track.querySelectorAll("clipitem"));
            if (clipItems.length === 0) return;

            // Template from the first clipitem
            var templateClip = clipItems[0];
            var parent = templateClip.parentNode;

            // Remove existing clipitems
            clipItems.forEach(function (c) { parent.removeChild(c); });

            var accumulatedTimelineFrames = 0;

            speechSegments.forEach(function (segment, index) {
                var clone = templateClip.cloneNode(true);
                clone.setAttribute("id", (templateClip.getAttribute("id") || "clip") + "_cut_" + (index + 1));

                var inFrames = Math.round(segment.start * fps);
                var outFrames = Math.round(segment.end * fps);
                var durFrames = outFrames - inFrames;

                if (durFrames <= 0) return;

                var startFrames = accumulatedTimelineFrames;
                var endFrames = startFrames + durFrames;
                accumulatedTimelineFrames += durFrames;

                // Update start, end, in, out nodes
                var nodeStart = clone.querySelector("start");
                var nodeEnd = clone.querySelector("end");
                var nodeIn = clone.querySelector("in");
                var nodeOut = clone.querySelector("out");

                if (nodeStart) nodeStart.textContent = String(startFrames);
                if (nodeEnd) nodeEnd.textContent = String(endFrames);
                if (nodeIn) nodeIn.textContent = String(inFrames);
                if (nodeOut) nodeOut.textContent = String(outFrames);

                parent.appendChild(clone);
            });
        });

        // Update overall sequence duration
        var totalSeqFrames = speechSegments.reduce(function (sum, seg) {
            return sum + Math.round((seg.end - seg.start) * fps);
        }, 0);

        var durationNode = xmlDoc.querySelector("sequence > duration");
        if (durationNode) {
            durationNode.textContent = String(totalSeqFrames);
        }

        var serializer = new XMLSerializer();
        return serializer.serializeToString(xmlDoc);
    }
};

