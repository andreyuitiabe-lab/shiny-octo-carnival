#!/bin/bash
# Double-click this file in Finder to run Parcel Scout.
# It pulls every vacant-land parcel in a target NY county, scores each as a
# mailing lead, auto-runs the free flood/wetland/slope diligence on the top
# leads, and opens the report in your browser.
#
# To change the county, edit the COUNTY line below (must be a NY county in the
# free state dataset — e.g. Genesee, Wayne, Livingston, Ontario, Steuben).
cd "$(dirname "$0")"
COUNTY="Genesee"
echo "Running Parcel Scout for $COUNTY County, NY..."
echo "(Pulls free state parcel data + runs FEMA/USFWS/USGS diligence on the top leads.)"
echo
/usr/bin/python3 parcel_scout.py --county "$COUNTY"
echo
echo "Report opened in your browser. You can close this window."
