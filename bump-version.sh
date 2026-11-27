#!/bin/sh
# Stamp a new version on the app's scripts so browsers (and the Quest browser) fetch the
# latest code after each update instead of mixing in cached copies. Run before committing.
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M)
perl -pi -e "s/\?v=\d+/?v=$V/g" index.html
echo "version $V"
# the page's security rule names the import map by its fingerprint, which the new version just changed
NODE=$(command -v node || echo "$LOCALAPPDATA/node-portable/node-v26.13.0-win-x64/node")
"$NODE" tools/csp.mjs || echo "WARNING: run node tools/csp.mjs before publishing"
