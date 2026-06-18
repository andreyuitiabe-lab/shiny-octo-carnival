#!/bin/bash
# Double-click this file in Finder to run the County Opportunity Scanner.
# It refreshes the data (if older than a week), re-scores every county,
# and opens the report in your browser.
cd "$(dirname "$0")"
echo "Running County Opportunity Scanner..."
echo "(First run downloads ~241MB; later runs reuse cached data and are fast.)"
echo
/usr/bin/python3 county_scanner.py
echo
echo "Building the readable scores report..."
/usr/bin/python3 county_report.py
echo
echo "Report opened in your browser (with a link to the full interactive table)."
echo "You can close this window."
