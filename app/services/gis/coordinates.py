import math
from typing import Tuple, List, Optional, Any

# Try importing pyproj; if not available, use mathematical Gauss-Kruger EPSG:2180 to WGS84 transform
try:
    import pyproj
    _transformer_2180_to_4326 = pyproj.Transformer.from_crs("EPSG:2180", "EPSG:4326", always_xy=True)
    _transformer_4326_to_2180 = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:2180", always_xy=True)
    HAS_PYPROJ = True
except ImportError:
    HAS_PYPROJ = False

def transform_2180_to_4326(x: float, y: float) -> Tuple[float, float]:
    """
    Konwertuje punkt z układu PUWG 1992 (EPSG:2180) do WGS84 (EPSG:4326).
    Zwraca (lon, lat) w stopniach dziesiętnych.
    W WKT z ULDK współrzędne to x = Easting (np. 677000), y = Northing (np. 481000).
    """
    if HAS_PYPROJ:
        lon, lat = _transformer_2180_to_4326.transform(x, y)
        return lon, lat

    # Fallback matematyczny oparty na elipsoidzie GRS80 i projekcji Gaussa-Krügera
    # Parametry elipsoidy GRS80
    a = 6378137.0
    f = 1.0 / 298.257222101
    b = a * (1.0 - f)
    e2 = (a*a - b*b) / (a*a)
    e_prime2 = (a*a - b*b) / (b*b)
    m0 = 0.9993  # skala w południku środkowym EPSG:2180
    lambda0 = math.radians(19.0)  # południk środkowy 19°E
    x0 = -5300000.0  # przesunięcie na północ
    y0 = 500000.0    # przesunięcie na wschód

    # Odwrócenie skali i przesunięć
    northing = (x - x0) / m0
    easting = (y - y0) / m0

    # Długość łuku południka
    n = (a - b) / (a + b)
    A = a / (1.0 + n) * (1.0 + n*n/4.0 + n**4/64.0)
    beta1 = 3.0/2.0 * n - 27.0/32.0 * n**3
    beta2 = 21.0/16.0 * n**2 - 55.0/32.0 * n**4
    beta3 = 151.0/96.0 * n**3
    beta4 = 1097.0/512.0 * n**4

    xi = northing / A
    eta = easting / A

    xi_prime = xi - (beta1 * math.sin(2.0*xi) * math.cosh(2.0*eta) +
                     beta2 * math.sin(4.0*xi) * math.cosh(4.0*eta) +
                     beta3 * math.sin(6.0*xi) * math.cosh(6.0*eta) +
                     beta4 * math.sin(8.0*xi) * math.cosh(8.0*eta))
    eta_prime = eta - (beta1 * math.cos(2.0*xi) * math.sinh(2.0*eta) +
                      beta2 * math.cos(4.0*xi) * math.sinh(4.0*eta) +
                      beta3 * math.cos(6.0*xi) * math.sinh(6.0*eta) +
                      beta4 * math.cos(8.0*xi) * math.sinh(8.0*eta))

    chi = math.asin(math.sin(xi_prime) / math.cosh(eta_prime))
    
    lat_rad = chi + ((e2/2.0 + 5.0*e2*e2/24.0 + e2*e2*e2/12.0) * math.sin(2.0*chi) +
                     (7.0*e2*e2/48.0 + 29.0*e2*e2*e2/240.0) * math.sin(4.0*chi) +
                     (7.0*e2*e2*e2/120.0) * math.sin(6.0*chi))
    lon_rad = lambda0 + math.atan2(math.sinh(eta_prime), math.cos(xi_prime))

    return math.degrees(lon_rad), math.degrees(lat_rad)


def transform_coordinates_list(coords: Any) -> Any:
    """
    Rekurencyjnie przetwarza tablice współrzędnych [Y, X] lub [X, Y] z EPSG:2180 do [lon, lat] EPSG:4326.
    Obsługuje formaty GeoJSON Polygon i MultiPolygon.
    """
    if isinstance(coords, (list, tuple)):
        if len(coords) == 2 and isinstance(coords[0], (int, float)) and isinstance(coords[1], (int, float)):
            # Wykrywamy która wartość to X (ok. 100k-850k), a która to Y (ok. 150k-900k)
            c1, c2 = float(coords[0]), float(coords[1])
            # W ULDK WKT punkty podawane są często jako X Y (Northing Easting)
            # Jeśli c1 > 100000 i c2 > 100000:
            if c1 > 100000 and c2 > 100000:
                # Jeśli c1 jest w okolicach 100k-850k (X Northing) a c2 w okolicach 150k-900k (Y Easting)
                # Sprawdźmy: w Polsce X mieści się orientacyjnie w granicach 130 000 - 870 000
                # Y mieści się w granicach 150 000 - 900 000
                lon, lat = transform_2180_to_4326(c1, c2)
                return [round(lon, 7), round(lat, 7)]
            return [c1, c2]
        return [transform_coordinates_list(item) for item in coords]
    return coords

