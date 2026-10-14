"""Install the verified Colombia vector map during the server image build."""

import hashlib
import os
import urllib.request
from pathlib import Path


URL = os.getenv(
    "COFFEE_FLY_MAP_ASSET_URL",
    "https://github.com/tugf8i2/Coffee-fly/releases/download/maps-colombia-2026-09/coffee-fly-colombia.mbtiles",
)
EXPECTED_SHA256 = "05318375aabfac11a3e3c69825c691100dbf7f94fb3deabd1af9f82372a46288"
TARGET = Path(os.getenv("COFFEE_FLY_MAP_DB", "/app/maps/coffee-fly-colombia.mbtiles"))


def main():
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    partial = TARGET.with_suffix(".download")
    digest = hashlib.sha256()
    request = urllib.request.Request(URL, headers={"User-Agent": "CoffeeFly-MapBuild/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                digest.update(chunk)
                output.write(chunk)
        if digest.hexdigest() != EXPECTED_SHA256:
            raise RuntimeError("El archivo cartográfico no coincide con el SHA-256 verificado.")
        partial.replace(TARGET)
        print(f"Mapa de Colombia instalado: {TARGET} ({TARGET.stat().st_size} bytes)")
    finally:
        partial.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
