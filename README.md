A tool to help them develop an imaging target list, plan the best time of the year to capture those targets, help you plan nightly imaging sequences with multiple targets, and preserve your imaging logs and notes. All this is available in other tools in one form or another. I was just trying to make an A-Z single-source tool to allow planning to be quick, easy, and fun. I'm interested in feedback on how to make it better, additional features, bugs, etc.

Here's a list of features.


-   Internet not needed. There are some features that link to other sites (Wikipedia, Astrobin, location weather forecasts) if you have access to the web, but network access is not necessary to use it.
-   Target database of almost 14,600 deep space objects.
-   Multiple locations allow you to plan for multiple imaging sites.
-   Four style themes, including a night theme.
-   Text search to find target
-   Filter targets by catalog, type, "best month", angular size, magnitude
-   Add targets to your To Do list.
-   Pin targets to use in sequence planning
-   To Do list has multiple views including tonight's rise time, best month, and target type
-   Graphical display of target visibility for a single day, but can calculate up to a year's worth of visibility charts at one time so you can quickly peruse them. Visibility score includes calculations using minimum altitude and location-based horizon file. Visibility score is calculated and displayed from noon to noon using dusk/dawn times, target rise/set times, moon rise/set times, and moon angle from target and illumination (phase).
-   Yearly observability chart - the best time to image in the upcoming year. Includes moon illumination and target altitude in scoring. User-settable minimum altitude also displays for reference.
-   Field of view visualization using the angular min/max size of the object (if available). No images - just a general idea of how a target will fill a specified telescope/sensor FOV. Optional full moon-sized overlay to provide relative scale.
-   Sequence Planner. Set location, time to start, altitude constraints, autofocus profile, meridian flip profile, calibration profile. Sequence takes into account these time overhead factors as well as meridian flips to provide a dynamic, graphical display and text suggestions for building a plan in your imaging software. Adjust the target sliders and the sequence changes in real time. Simple optimization based on transit time or you can change the order of target imaging manually.
-   Imaging log with projects (M 31, for example), sessions for that project (image sessions with specific filters, sensor and telescope settings, environmental conditions, notes for both projects and session. I store processing details at the project level and record nightly issues or items of note at the session level.
-   Programs - keep track (automagically based on project data) of how many  targets you've imaged in either a catalog or user-defined list. Reports for imaging programs statistics. Ultimately I want to integrate it more closely with the Astro League observing programs - I've already started talking to them about it.
-   I adding a catalog feature next so that you can specify URLs in astrobin or other imaging catalog online sites that will link directly from the project logs.


That's a lot of words. I'm testing and refining. I haven't actually tested the accuracy (timing) of the sequence planner yet because no clear nights. Just looking for a few folks who might find such a tool helpful to them and who are interested in taking a look and providing feedback on anything related to the app. Consider this an Alpha version. Definitely no guarantees about anything, but I've done considerable testing and the astronomical calculations are within a few minutes of Stellarium and timeanddate.com. The app uses browser storage - the future "real" app will eventually use local disk storage. Delivery to you will be code files with a target backup file that you'll import into the app. After that everything runs in browser storage and will last until you clear the browser cache or the browser self-clears after inactivity - then just reimport the targeting backup. If you're actually using the tool to preserve imaging logs, you can generate backups and import as needed. I promise that the "final" version will have a way to import backup files from the current version.
