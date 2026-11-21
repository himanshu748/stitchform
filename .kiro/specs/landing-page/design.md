# Design: Stitchform landing page

The page starts with the outcome for an applicant or helper, followed by a side-by-side comparison of the fictional Moonfield scholarship photo and a PDF produced by Stitchform. The next section explains why date formats, required fields and signatures cause rework. Three sequential steps connect those problems to field detection, guided answers and printable output. A privacy section explains defaults and opt-ins.

The figure is the main visual. Captions sit with their document through proximity, both pages use the same mat proportions for similarity, and a short stitched arrow indicates the direction of the workflow. Split composition combines a left-aligned headline with the proof on its right. On narrow screens, text comes first and the figures stay paired. DM Sans connects both surfaces. Midnight (#172238), ink (#1b2941), cobalt (#294fbf), white (#ffffff) and blue mist (#edf2ff) link the landing page to the existing editor. The landing has no animated elements.

The design pairs the outcome with document imagery and gives the workflow named, sequential actions. References for those patterns are the [Adobe Scan product page](https://www.adobe.com/acrobat/mobile/scanner-app.html) and [GOV.UK student finance application guide](https://www.gov.uk/apply-for-student-finance).

Vite builds separate static HTML entries for the landing and app. The production landing loads no editor JavaScript. Ordinary links open `/app/` or pass a built-in sample ID. The app validates that ID against the existing allowlist and uses the same template loader as the picker. An individual sample loads only its own template. The app consumes the entry parameter so normal reload and stitch-code operations return to the picker. Failed loads recover to the picker. [Vite multi-page build documentation](https://vite.dev/guide/build.html#multi-page-app)

Primary judging criterion is Presentation, supported by Design. Verification covers mobile and desktop renders, opening a sample by keyboard, typed input, date validation and PDF output from the landing entry point.
