#!/bin/bash
# Double-click this file in Finder to run Satellite Scout.
# It takes the top leads from your latest Parcel Scout run and vets each one
# from the sky: satellite close-up with the parcel boundary drawn, land cover
# (trees / open / wet), road access, and an EYEBALL score — then opens a photo
# gallery where you ✓ keep or ✗ reject parcels and export the keepers.
#
# Run Parcel Scout FIRST (it produces the ranked list this tool reads).
# To change the county or how many leads to vet, edit the two lines below.
cd "$(dirname "$0")"
COUNTY="Genesee"
TOP=40
echo "Running Satellite Scout for $COUNTY County, NY (top $TOP leads)..."
echo "(Free Sentinel-2 land cover + TIGER roads + Esri imagery — takes a few minutes.)"
echo
/usr/bin/python3 satellite_scout.py --county "$COUNTY" --top "$TOP"
echo
echo "Gallery opened in your browser. You can close this window."
