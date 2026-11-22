import asyncio
import unittest.mock as mock
import httpx
import pytest

from app.services.gis.terrain import (
    _TERRAIN_CACHE,
    _build_overpass_query,
    _compute_slope_and_aspect,
    fetch_slope_and_aspect_from_dem,
    fetch_terrain_and_hydro,
    query_overpass_hydro_and_landscape,
)
from app.core.config import settings


def test_overpass_query_contains_waterways_wetlands_and_windbreaks():
    q = _build_overpass_query(52.185, 21.567)
    assert "[timeout:4]" in q
    assert 'way["waterway"~"ditch|drain|stream|canal|river"](around:500,52.185,21.567)' in q
    assert 'way["natural"~"water|wetland"](around:500,52.185,21.567)' in q
    assert 'relation["natural"~"water|wetland"](around:500,52.185,21.567)' in q
    assert 'way["natural"~"tree_row|wood"](around:300,52.185,21.567)' in q
    assert 'way["barrier"="hedge"](around:300,52.185,21.567)' in q
    assert "out geom;" in q


def test_overpass_parses_ditch_wetland_and_windbreak():
    mock_resp = mock.Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "elements": [
            {
                "type": "way",
                "id": 101,
                "tags": {"waterway": "ditch"},
                "geometry": [
                    {"lat": 52.186, "lon": 21.566},
                    {"lat": 52.186, "lon": 21.568},
                ],
            },
            {
                "type": "way",
                "id": 202,
                "tags": {"natural": "wetland"},
                "geometry": [{"lat": 52.187, "lon": 21.567}],
            },
            {
                "type": "way",
                "id": 303,
                "tags": {"barrier": "hedge"},
                "geometry": [{"lat": 52.1855, "lon": 21.5675}],
            },
        ]
    }

    mock_client = mock.AsyncMock()
    mock_client.post.return_value = mock_resp

    res = asyncio.run(query_overpass_hydro_and_landscape(mock_client, 52.185, 21.567))

    assert res["hydro_data_available"] is True
    assert res["hydro_limitation"] is None
    assert res["distance_to_ditch_m"] is not None
    assert 90.0 <= res["distance_to_ditch_m"] <= 130.0
    assert res["nearest_waterway_type"] == "ditch"
    assert res["nearest_waterway_coords"] == [[52.186, 21.566], [52.186, 21.568]]
    assert res["nearest_waterway_point"] is not None
    assert res["has_wetland_or_pond_nearby"] is True
    assert res["has_windbreak_nearby"] is True


def test_overpass_empty_result_returns_none_without_fake_450():
    mock_resp = mock.Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"elements": []}

    mock_client = mock.AsyncMock()
    mock_client.post.return_value = mock_resp

    res = asyncio.run(query_overpass_hydro_and_landscape(mock_client, 52.185, 21.567))

    assert res["hydro_data_available"] is True
    assert res["hydro_limitation"] is None
    assert res["distance_to_ditch_m"] is None
    assert res["nearest_waterway_coords"] is None
    assert res["has_wetland_or_pond_nearby"] is False
    assert res["has_windbreak_nearby"] is False


def test_overpass_uses_fallback_mirror_when_primary_times_out():
    fallback_resp = mock.Mock()
    fallback_resp.status_code = 200
    fallback_resp.json.return_value = {
        "elements": [
            {
                "type": "way",
                "id": 404,
                "tags": {"waterway": "stream"},
                "geometry": [
                    {"lat": 52.1855, "lon": 21.567},
                    {"lat": 52.1855, "lon": 21.568},
                ],
            }
        ]
    }

    mock_client = mock.AsyncMock()
    mock_client.post.side_effect = [
        httpx.TimeoutException("Primary Overpass timeout"),
        fallback_resp,
    ]

    res = asyncio.run(query_overpass_hydro_and_landscape(mock_client, 52.185, 21.567))

    assert mock_client.post.call_count == 2
    assert mock_client.post.call_args_list[0].args[0] == settings.OVERPASS_API_URL
    assert mock_client.post.call_args_list[1].args[0] == settings.OVERPASS_FALLBACK_URL
    assert res["hydro_data_available"] is True
    assert res["nearest_waterway_type"] == "stream"
    assert res["distance_to_ditch_m"] is not None
    assert res["distance_to_ditch_m"] < 80.0


def test_overpass_all_mirrors_fail_returns_none_and_limitation_without_fake_120():
    mock_client = mock.AsyncMock()
    mock_client.post.side_effect = httpx.TimeoutException("Overpass timeout")

    res = asyncio.run(query_overpass_hydro_and_landscape(mock_client, 52.185, 21.567))

    assert mock_client.post.call_count == 2
    assert res["distance_to_ditch_m"] is None
    assert res["hydro_data_available"] is False
    assert res["hydro_limitation"] is not None
    assert "Overpass" in res["hydro_limitation"]
    assert res["has_wetland_or_pond_nearby"] is None
    assert res["has_windbreak_nearby"] is None


def test_fetch_terrain_and_hydro_does_not_cache_overpass_failure():
    _TERRAIN_CACHE.clear()
    with (
        mock.patch(
            "app.services.gis.terrain.fetch_slope_and_aspect_from_dem",
            new=mock.AsyncMock(
                return_value={
                    "slope_percent": 2.4,
                    "aspect_direction": "południowo-zachodni",
                    "dem_source": "Open-Meteo Elevation DEM",
                    "dem_available": True,
                    "dem_limitation": None,
                }
            ),
        ),
        mock.patch("app.services.gis.terrain.get_imgw_stations", new=mock.AsyncMock(return_value=[])),
        mock.patch(
            "app.services.gis.terrain.query_overpass_hydro_and_landscape",
            new=mock.AsyncMock(
                return_value={
                    "distance_to_ditch_m": None,
                    "hydro_data_available": False,
                    "hydro_limitation": "Overpass niedostępny",
                    "nearest_waterway_coords": None,
                    "nearest_waterway_point": None,
                    "nearest_waterway_type": None,
                    "has_wetland_or_pond_nearby": None,
                    "has_windbreak_nearby": None,
                }
            ),
        ),
    ):
        res = asyncio.run(fetch_terrain_and_hydro(52.185, 21.567))

    assert res["distance_to_ditch_m"] is None
    assert res["hydro_data_available"] is False
    assert res["hydro_limitation"] == "Overpass niedostępny"
    assert len(_TERRAIN_CACHE) == 0


def test_compute_slope_and_aspect_southwest_runoff():
    # N i E są wyżej niż S i W -> woda spływa na południowy zachód
    # dz_dy = (306 - 300) / 100 = 0.06, dz_dx = (306 - 300) / 100 = 0.06
    # slope = hypot(0.06, 0.06) * 100 = 8.485 -> 8.5%
    slope, aspect = _compute_slope_and_aspect(h_n=306.0, h_s=300.0, h_e=306.0, h_w=300.0, step_m=50.0)
    assert slope == 8.5
    assert aspect == "południowo-zachodni"


def test_dem_uses_open_meteo_elevation_5_points():
    mock_resp = mock.Mock()
    mock_resp.status_code = 200
    # [center, N, S, E, W] -> 5 m różnicy na 100 m w osi N-S -> spadek 5.0%, spływ na południe
    mock_resp.json.return_value = {"elevation": [250.0, 252.5, 247.5, 250.0, 250.0]}

    mock_client = mock.AsyncMock()
    mock_client.get.return_value = mock_resp

    res = asyncio.run(fetch_slope_and_aspect_from_dem(mock_client, 49.62, 20.69))

    assert mock_client.get.call_count == 1
    assert mock_client.get.call_args.args[0] == settings.OPEN_METEO_ELEVATION_URL
    assert len(mock_client.get.call_args.kwargs["params"]["latitude"].split(",")) == 5
    assert res["dem_available"] is True
    assert res["slope_percent"] == 5.0
    assert res["aspect_direction"] == "południowy"
    assert res["dem_source"] == "Open-Meteo Elevation DEM"
    assert res["dem_limitation"] is None


def test_dem_falls_back_to_gugik_nmt_when_open_meteo_fails():
    mock_client = mock.AsyncMock()
    mock_client.get.side_effect = httpx.TimeoutException("Open-Meteo timeout")

    with mock.patch(
        "app.services.gis.terrain.fetch_elevation_point_gugik",
        new=mock.AsyncMock(side_effect=[120.0, 120.0, 120.0, 118.0, 122.0]),
    ):
        res = asyncio.run(fetch_slope_and_aspect_from_dem(mock_client, 52.185, 21.567))

    assert res["dem_available"] is True
    assert res["slope_percent"] == 4.0
    assert res["aspect_direction"] == "wschodni"
    assert res["dem_source"] == "Geoportal NMT (GUGiK)"


def test_dem_unavailable_returns_none_without_hardcoded_1_8():
    mock_client = mock.AsyncMock()
    mock_client.get.side_effect = httpx.TimeoutException("Open-Meteo timeout")

    with mock.patch(
        "app.services.gis.terrain.fetch_elevation_point_gugik",
        new=mock.AsyncMock(return_value=None),
    ):
        res = asyncio.run(fetch_slope_and_aspect_from_dem(mock_client, 52.185, 21.567))

    assert res["dem_available"] is False
    assert res["slope_percent"] is None
    assert res["aspect_direction"] is None
    assert res["dem_limitation"] is not None
    assert "DEM" in res["dem_limitation"]


def test_acceptance_foothill_slope_triggers_contour_farming_and_landscape_rules():
    from app.services.science.decision_engine import evaluate_rules
    from app.services.science.report_generator import generate_retention_actions

    # Kryterium odbioru: działka podgórska (spadek 8.5%), brak rowów w 500 m (None),
    # wykryte oczko/mokradło i brak zadrzewień w 300 m przy deficycie
    eval_res = evaluate_rules(
        kbw_30d=-55.0,
        kbw_60d=-110.0,
        awc_mm=48.0,
        soil_category="lekka",
        slope_percent=8.5,
        distance_to_ditch_m=None,
        ndvi_anomaly_percent=-5.0,
        crop_name="kukurydza",
        area_ha=2.0,
        has_wetland_or_pond_nearby=True,
        has_windbreak_nearby=False,
    )
    rule_ids = [r["rule_id"] for r in eval_res["active_rules"]]
    assert "CONTOUR_FARMING_SLOPE" in rule_ids
    assert "RETENTION_DITCH_WEIR" not in rule_ids
    assert "WETLAND_POND_PROTECTION" in rule_ids
    assert "WINDBREAK_SHELTERBELT" in rule_ids

    actions = generate_retention_actions(eval_res["active_rules"])
    action_ids = [a.id for a in actions]
    assert "CONTOUR_FARMING_SLOPE" in action_ids
    assert "WETLAND_POND_PROTECTION" in action_ids
    assert "WINDBREAK_SHELTERBELT" in action_ids
