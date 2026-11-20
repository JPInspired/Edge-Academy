#!/bin/sh
# Stamp a new version on the app's scripts so browsers (and the Quest browser) fetch the
# latest code after each update instead of mixing in cached copies. Run before committing.
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M)
perl -pi -e "s/\?v=\d+/?v=$V/g" index.html
echo "version $V"
