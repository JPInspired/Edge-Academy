#!/bin/sh
# Starts Edge Preview at http://localhost:8090 (needs Python 3)
cd "$(dirname "$0")"
(sleep 1; open http://localhost:8090/ 2>/dev/null || xdg-open http://localhost:8090/ 2>/dev/null) &
python3 -m http.server 8090
